#!/usr/bin/env python3
"""Audit a class-folder plant disease image dataset without changing images."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import struct
import zlib
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".gif", ".webp"}
TARGET_CROP_ALIASES = {
    "Tomato": ("tomato",),
    "Potato": ("potato",),
    "Chilli": ("chilli", "chili"),
    "Rice": ("rice",),
    "Maize": ("maize",),
    "Cotton": ("cotton",),
}
CHUNK_SIZE = 1024 * 1024


class ImageAuditError(ValueError):
    """Raised when an image fails a structural integrity check."""


def _read_exact(handle: Any, size: int) -> bytes:
    data = handle.read(size)
    if len(data) != size:
        raise ImageAuditError("unexpected end of file")
    return data


def _png_info(path: Path) -> tuple[int, int, str]:
    signature = b"\x89PNG\r\n\x1a\n"
    width = height = 0
    seen_ihdr = seen_iend = seen_idat = False
    decompressor = zlib.decompressobj()
    with path.open("rb") as handle:
        if _read_exact(handle, 8) != signature:
            raise ImageAuditError("invalid PNG signature")
        while not seen_iend:
            length_bytes = _read_exact(handle, 4)
            length = struct.unpack(">I", length_bytes)[0]
            chunk_type = _read_exact(handle, 4)
            if length > path.stat().st_size:
                raise ImageAuditError("PNG chunk length exceeds file size")
            data = _read_exact(handle, length)
            expected_crc = struct.unpack(">I", _read_exact(handle, 4))[0]
            actual_crc = zlib.crc32(chunk_type)
            actual_crc = zlib.crc32(data, actual_crc) & 0xFFFFFFFF
            if actual_crc != expected_crc:
                raise ImageAuditError(f"PNG CRC mismatch in {chunk_type.decode('ascii', 'replace')}")
            if chunk_type == b"IHDR":
                if seen_ihdr or length != 13:
                    raise ImageAuditError("invalid PNG IHDR")
                width, height, bit_depth, color_type, compression, filtering, interlace = struct.unpack(
                    ">IIBBBBB", data
                )
                if not width or not height or bit_depth not in (1, 2, 4, 8, 16):
                    raise ImageAuditError("invalid PNG dimensions or bit depth")
                if color_type not in (0, 2, 3, 4, 6) or compression != 0 or filtering != 0 or interlace not in (0, 1):
                    raise ImageAuditError("invalid PNG image header")
                seen_ihdr = True
            elif chunk_type == b"IDAT":
                if not seen_ihdr or seen_iend:
                    raise ImageAuditError("PNG image data appears in an invalid position")
                seen_idat = True
                try:
                    pending = data
                    while pending:
                        decompressor.decompress(pending, CHUNK_SIZE)
                        pending = decompressor.unconsumed_tail
                except zlib.error as exc:
                    raise ImageAuditError(f"invalid PNG compressed image data: {exc}") from exc
            elif chunk_type == b"IEND":
                if length != 0 or not seen_ihdr or not seen_idat:
                    raise ImageAuditError("invalid PNG IEND")
                seen_iend = True
        if handle.read(1):
            raise ImageAuditError("unexpected data after PNG IEND")
    try:
        decompressor.flush()
    except zlib.error as exc:
        raise ImageAuditError(f"invalid PNG compressed image data: {exc}") from exc
    if not decompressor.eof:
        raise ImageAuditError("truncated PNG compressed image data")
    return width, height, "PNG"


def _jpeg_info(path: Path) -> tuple[int, int, str]:
    sof_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    width = height = 0
    with path.open("rb") as handle:
        if _read_exact(handle, 2) != b"\xff\xd8":
            raise ImageAuditError("invalid JPEG start marker")
        while True:
            marker_prefix = _read_exact(handle, 1)
            if marker_prefix != b"\xff":
                raise ImageAuditError("invalid JPEG marker sequence")
            marker_byte = _read_exact(handle, 1)
            while marker_byte == b"\xff":
                marker_byte = _read_exact(handle, 1)
            marker = marker_byte[0]
            if marker == 0xD9:
                break
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                continue
            segment_length = struct.unpack(">H", _read_exact(handle, 2))[0]
            if segment_length < 2:
                raise ImageAuditError("invalid JPEG segment length")
            segment = _read_exact(handle, segment_length - 2)
            if marker in sof_markers:
                if len(segment) < 6:
                    raise ImageAuditError("truncated JPEG frame header")
                height, width = struct.unpack(">HH", segment[1:5])
            if marker == 0xDA:
                if not width or not height:
                    raise ImageAuditError("JPEG has no valid frame dimensions")
                handle.seek(-2, os.SEEK_END)
                if _read_exact(handle, 2) != b"\xff\xd9":
                    raise ImageAuditError("JPEG scan is truncated or missing its EOI marker")
                break
    return width, height, "JPEG"


def _bmp_info(path: Path) -> tuple[int, int, str]:
    with path.open("rb") as handle:
        header = _read_exact(handle, 26)
        if header[:2] != b"BM":
            raise ImageAuditError("invalid BMP signature")
        declared_size, _, _, pixel_offset = struct.unpack("<IHHI", header[2:14])
        dib_size = struct.unpack("<I", header[14:18])[0]
        if dib_size < 12:
            raise ImageAuditError("unsupported BMP header")
        if dib_size == 12:
            width, height = struct.unpack("<HH", header[18:22])
        else:
            width, height = struct.unpack("<ii", header[18:26])
            height = abs(height)
        actual_size = path.stat().st_size
        if not width or not height or pixel_offset >= actual_size:
            raise ImageAuditError("invalid BMP dimensions or pixel offset")
        if declared_size and declared_size > actual_size:
            raise ImageAuditError("truncated BMP file")
    return width, height, "BMP"


def _gif_info(path: Path) -> tuple[int, int, str]:
    with path.open("rb") as handle:
        header = _read_exact(handle, 13)
        if header[:6] not in (b"GIF87a", b"GIF89a"):
            raise ImageAuditError("invalid GIF signature")
        width, height = struct.unpack("<HH", header[6:10])
        handle.seek(-1, os.SEEK_END)
        if _read_exact(handle, 1) != b";":
            raise ImageAuditError("GIF trailer is missing")
    if not width or not height:
        raise ImageAuditError("invalid GIF dimensions")
    return width, height, "GIF"


def _webp_info(path: Path) -> tuple[int, int, str]:
    with path.open("rb") as handle:
        header = _read_exact(handle, 30)
        if header[:4] != b"RIFF" or header[8:12] != b"WEBP":
            raise ImageAuditError("invalid WebP signature")
        declared_size = struct.unpack("<I", header[4:8])[0] + 8
        if declared_size > path.stat().st_size:
            raise ImageAuditError("truncated WebP RIFF data")
        chunk = header[12:16]
        if chunk == b"VP8X":
            width = 1 + int.from_bytes(header[24:27], "little")
            height = 1 + int.from_bytes(header[27:30], "little")
        elif chunk == b"VP8 " and header[23:26] == b"\x9d\x01\x2a":
            width = struct.unpack("<H", header[26:28])[0] & 0x3FFF
            height = struct.unpack("<H", header[28:30])[0] & 0x3FFF
        elif chunk == b"VP8L" and header[20] == 0x2F:
            bits = int.from_bytes(header[21:25], "little")
            width = (bits & 0x3FFF) + 1
            height = ((bits >> 14) & 0x3FFF) + 1
        else:
            raise ImageAuditError("unsupported or truncated WebP header")
    if not width or not height:
        raise ImageAuditError("invalid WebP dimensions")
    return width, height, "WebP"


def _tiff_info(path: Path) -> tuple[int, int, str]:
    with path.open("rb") as handle:
        header = _read_exact(handle, 8)
        if header[:2] == b"II":
            endian = "<"
        elif header[:2] == b"MM":
            endian = ">"
        else:
            raise ImageAuditError("invalid TIFF byte order")
        if struct.unpack(endian + "H", header[2:4])[0] != 42:
            raise ImageAuditError("invalid TIFF magic number")
        ifd_offset = struct.unpack(endian + "I", header[4:8])[0]
        if ifd_offset + 2 > path.stat().st_size:
            raise ImageAuditError("TIFF IFD offset is outside the file")
        handle.seek(ifd_offset)
        count = struct.unpack(endian + "H", _read_exact(handle, 2))[0]
        if ifd_offset + 2 + count * 12 + 4 > path.stat().st_size:
            raise ImageAuditError("truncated TIFF directory")
        tags: dict[int, tuple[int, int]] = {}
        for _ in range(count):
            entry = _read_exact(handle, 12)
            tag, field_type, values = struct.unpack(endian + "HHI", entry[:8])
            value = entry[8:12]
            if tag in (256, 257) and values == 1 and field_type in (3, 4):
                number = struct.unpack(endian + ("H" if field_type == 3 else "I"), value[:2] if field_type == 3 else value)[0]
                tags[tag] = (number, 1)
            elif tag in (256, 257) and values == 1 and field_type in (3, 4):
                value_offset = struct.unpack(endian + "I", value)[0]
                handle.seek(value_offset)
                number = struct.unpack(endian + ("H" if field_type == 3 else "I"), _read_exact(handle, 2 if field_type == 3 else 4))[0]
                tags[tag] = (number, 1)
                handle.seek(ifd_offset + 2 + (_ + 1) * 12)
        width = tags.get(256, (0, 0))[0]
        height = tags.get(257, (0, 0))[0]
    if not width or not height:
        raise ImageAuditError("TIFF has no valid width/height tags")
    return width, height, "TIFF"


def inspect_image(path: Path) -> tuple[int, int, str]:
    with path.open("rb") as handle:
        signature = handle.read(12)
    if signature.startswith(b"\x89PNG\r\n\x1a\n"):
        return _png_info(path)
    if signature.startswith(b"\xff\xd8"):
        return _jpeg_info(path)
    if signature.startswith(b"BM"):
        return _bmp_info(path)
    if signature[:6] in (b"GIF87a", b"GIF89a"):
        return _gif_info(path)
    if signature[:4] == b"RIFF" and signature[8:12] == b"WEBP":
        return _webp_info(path)
    if signature[:2] in (b"II", b"MM"):
        return _tiff_info(path)
    raise ImageAuditError("unrecognized image signature")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def audit(dataset_dir: Path, output_dir: Path) -> dict[str, Any]:
    if not dataset_dir.is_dir():
        raise FileNotFoundError(f"Dataset folder does not exist: {dataset_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)
    class_dirs = sorted((item for item in dataset_dir.iterdir() if item.is_dir()), key=lambda p: p.name.casefold())
    if not class_dirs:
        raise ValueError(f"No class folders found in {dataset_dir}")

    distribution_rows: list[dict[str, Any]] = []
    issue_rows: list[dict[str, str]] = []
    hashes: dict[str, list[dict[str, str]]] = defaultdict(list)
    total_images = 0

    for class_dir in class_dirs:
        image_paths = sorted(
            (path for path in class_dir.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS),
            key=lambda p: str(p).casefold(),
        )
        formats: Counter[str] = Counter()
        dimensions: Counter[str] = Counter()
        valid_count = 0
        corrupted_count = 0
        for path in image_paths:
            total_images += 1
            relative_path = path.relative_to(dataset_dir).as_posix()
            extension = path.suffix.lower().lstrip(".")
            try:
                width, height, detected_format = inspect_image(path)
                valid_count += 1
                formats[detected_format] += 1
                dimensions[f"{width}x{height}"] += 1
                if detected_format.casefold() != extension.casefold() and not (
                    detected_format == "JPEG" and extension in {"jpg", "jpeg"}
                ):
                    issue_rows.append({
                        "path": relative_path,
                        "issue": f"extension .{extension} does not match detected {detected_format}",
                    })
            except (OSError, ImageAuditError, struct.error, zlib.error) as exc:
                corrupted_count += 1
                issue_rows.append({"path": relative_path, "issue": str(exc)})
                detected_format = ""
                width = height = 0
            try:
                digest = sha256_file(path)
                hashes[digest].append({"path": relative_path, "class": class_dir.name})
            except OSError as exc:
                issue_rows.append({"path": relative_path, "issue": f"hash read failed: {exc}"})
        distribution_rows.append({
            "class": class_dir.name,
            "image_files": len(image_paths),
            "valid_images": valid_count,
            "corrupted_images": corrupted_count,
            "formats": dict(sorted(formats.items())),
            "dimensions": dict(sorted(dimensions.items())),
        })

    duplicate_groups = []
    for digest, records in sorted(hashes.items()):
        if len(records) > 1:
            class_names = sorted({record["class"] for record in records}, key=str.casefold)
            duplicate_groups.append({
                "sha256": digest,
                "copies": len(records),
                "classes": class_names,
                "cross_class": len(class_names) > 1,
                "files": records,
            })
    duplicate_rows = [
        {
            "sha256": group["sha256"],
            "copies": group["copies"],
            "cross_class": group["cross_class"],
            "classes": ";".join(group["classes"]),
            "paths": ";".join(record["path"] for record in group["files"]),
        }
        for group in duplicate_groups
    ]

    target_classes = [
        row for row in distribution_rows
        if any(
            alias in row["class"].casefold()
            for aliases in TARGET_CROP_ALIASES.values()
            for alias in aliases
        )
    ]
    distribution_report = {
        "dataset_dir": str(dataset_dir.resolve()),
        "class_folder_count": len(class_dirs),
        "image_file_count": total_images,
        "valid_images": sum(row["valid_images"] for row in distribution_rows),
        "corrupted_images": sum(row["corrupted_images"] for row in distribution_rows),
        "class_distribution": distribution_rows,
        "target_crop_class_folders": target_classes,
    }
    quality_report = {
        "dataset_dir": str(dataset_dir.resolve()),
        "image_validation": "Dependency-free structural validation; does not fully decode pixels.",
        "image_file_count": total_images,
        "valid_images": distribution_report["valid_images"],
        "corrupted_images": distribution_report["corrupted_images"],
        "class_quality": distribution_rows,
        "issues": issue_rows,
    }
    duplicate_report = {
        "duplicate_group_count": len(duplicate_groups),
        "duplicate_image_copies": sum(group["copies"] for group in duplicate_groups),
        "extra_duplicate_copies": sum(group["copies"] - 1 for group in duplicate_groups),
        "cross_class_duplicate_group_count": sum(group["cross_class"] for group in duplicate_groups),
        "cross_class_duplicate_image_copies": sum(
            group["copies"] for group in duplicate_groups if group["cross_class"]
        ),
        "cross_class_extra_duplicate_copies": sum(
            group["copies"] - 1 for group in duplicate_groups if group["cross_class"]
        ),
    }

    (output_dir / "class_distribution.json").write_text(json.dumps(distribution_report, indent=2), encoding="utf-8")
    write_csv(output_dir / "class_distribution.csv", list(distribution_rows[0].keys()), distribution_rows)
    (output_dir / "duplicate_report.json").write_text(
        json.dumps({**duplicate_report, "groups": duplicate_groups}, indent=2),
        encoding="utf-8",
    )
    write_csv(
        output_dir / "duplicate_report.csv",
        ["sha256", "copies", "cross_class", "classes", "paths"],
        duplicate_rows,
    )
    (output_dir / "image_quality_report.json").write_text(json.dumps(quality_report, indent=2), encoding="utf-8")
    write_csv(output_dir / "image_issues.csv", ["path", "issue"], issue_rows)
    return {**distribution_report, **duplicate_report}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_dataset = Path(__file__).parent / "datasets" / "plant_disease" / "raw" / "15 Crop 45 Disease and Healthy Leaf dataset"
    default_output = Path(__file__).parent / "reports" / "plant_disease_audit"
    parser.add_argument("--dataset-dir", type=Path, default=default_dataset)
    parser.add_argument("--output-dir", type=Path, default=default_output)
    args = parser.parse_args()
    result = audit(args.dataset_dir, args.output_dir)
    print(json.dumps({key: value for key, value in result.items() if key not in {"class_distribution", "target_crop_class_folders"}}, indent=2))
    print(f"Class distribution: {args.output_dir / 'class_distribution.csv'}")
    print(f"Duplicate report: {args.output_dir / 'duplicate_report.csv'}")
    print(f"Quality issues: {args.output_dir / 'image_issues.csv'}")


if __name__ == "__main__":
    main()
