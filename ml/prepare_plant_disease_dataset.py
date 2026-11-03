#!/usr/bin/env python3
"""Verify and prepare reproducible splits for AgriOne's six-crop disease dataset."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import shutil
import warnings
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import PIL
from PIL import Image, UnidentifiedImageError


SEED = 42
SPLIT_RATIOS = {"train": 0.70, "validation": 0.15, "test": 0.15}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".gif", ".webp"}
MINIMUM_DIMENSION = 64
MINIMUM_ASPECT_RATIO = 0.5
MAXIMUM_ASPECT_RATIO = 2.0
CHUNK_SIZE = 1024 * 1024

CLASS_MAPPING = {
    "healthy_tomato": ("Tomato", "Tomato - Healthy"),
    "leaf blight_tomato": ("Tomato", "Tomato - Leaf blight"),
    "septoria leaf spot_tomato": ("Tomato", "Tomato - Septoria leaf spot"),
    "Potato Early_Blight": ("Potato", "Potato - Early blight"),
    "Potato Healthy": ("Potato", "Potato - Healthy"),
    "Potato Late_Blight": ("Potato", "Potato - Late blight"),
    "Chili Healthy Leaf": ("Chilli", "Chilli - Healthy"),
    "Chilli Nutrition Deficiency": ("Chilli", "Chilli - Nutrition deficiency"),
    "Chilli White spot": ("Chilli", "Chilli - White spot"),
    "Rice___Brown_Spot": ("Rice", "Rice - Brown spot"),
    "Rice___Healthy": ("Rice", "Rice - Healthy"),
    "Rice___Leaf_Blast": ("Rice", "Rice - Leaf blast"),
    "healthy_maize": ("Maize", "Maize - Healthy"),
    "Maize leaf spot": ("Maize", "Maize - Leaf spot"),
    "Maize streak virus": ("Maize", "Maize - Streak virus"),
    "Cotton Bacterial Blight": ("Cotton", "Cotton - Bacterial blight"),
    "Cotton Curl Virus": ("Cotton", "Cotton - Curl virus"),
    "Cotton Healthy Leaf": ("Cotton", "Cotton - Healthy"),
}
SPLIT_NAMES = tuple(SPLIT_RATIOS)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            digest.update(chunk)
    return digest.hexdigest()


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def _read_duplicate_review(raw_dir: Path, audit_report_path: Path) -> tuple[list[dict[str, Any]], set[str]]:
    report = json.loads(audit_report_path.read_text(encoding="utf-8"))
    groups = [group for group in report["groups"] if group["cross_class"]]
    if len(groups) != 16:
        raise ValueError(f"Expected 16 audited cross-class duplicate groups, found {len(groups)}")

    review_rows: list[dict[str, Any]] = []
    excluded_target_paths: set[str] = set()
    for group in groups:
        labels = sorted({file["class"] for file in group["files"]}, key=str.casefold)
        target_files = []
        verified = True
        for file in group["files"]:
            relative_path = file["path"].replace("\\", "/")
            source = raw_dir / Path(relative_path)
            actual_hash = sha256_file(source) if source.is_file() else ""
            if actual_hash != group["sha256"]:
                verified = False
            if file["class"] in CLASS_MAPPING:
                target_files.append((relative_path, file["class"]))

        excluded_here = verified and bool(target_files)
        if excluded_here:
            excluded_target_paths.update(path for path, _ in target_files)
        review_rows.append({
            "sha256": group["sha256"],
            "original_class_labels": " | ".join(labels),
            "filenames": " | ".join(file["path"].replace("\\", "/") for file in group["files"]),
            "verified_against_raw": verified,
            "includes_target_crop": bool(target_files),
            "target_files_excluded": " | ".join(path for path, _ in target_files) if excluded_here else "",
            "decision": (
                "Excluded target-crop file(s); labels remain unresolved pending human review"
                if excluded_here
                else "Outside six-crop scope; no prepared image excluded"
            ),
        })
    if any(not row["verified_against_raw"] for row in review_rows):
        mismatched = [row["sha256"] for row in review_rows if not row["verified_against_raw"]]
        raise ValueError(f"Existing duplicate report does not match raw files for hashes: {mismatched}")
    return review_rows, excluded_target_paths


def _verify_image(path: Path) -> tuple[str, int, int]:
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                image.load()
                if image.width <= 0 or image.height <= 0:
                    raise ValueError("invalid image dimensions")
                return image.format or "UNKNOWN", image.width, image.height
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ValueError(f"{type(exc).__name__}: {exc}") from exc


def _target_counts(total: int) -> dict[str, int]:
    exact = {name: total * ratio for name, ratio in SPLIT_RATIOS.items()}
    counts = {name: int(value) for name, value in exact.items()}
    remainder = total - sum(counts.values())
    priority = sorted(SPLIT_NAMES, key=lambda name: (exact[name] - counts[name], -SPLIT_NAMES.index(name)), reverse=True)
    for name in priority[:remainder]:
        counts[name] += 1
    return counts


def assign_grouped_splits(
    class_groups: dict[str, list[list[dict[str, Any]]]], seed: int = SEED
) -> dict[str, str]:
    """Assign each exact-hash group wholly to one split, independently by class."""
    assignment: dict[str, str] = {}
    for class_name in sorted(class_groups, key=str.casefold):
        groups = list(class_groups[class_name])
        rng = random.Random(f"{seed}:{class_name}")
        rng.shuffle(groups)
        groups.sort(key=len, reverse=True)
        total = sum(len(group) for group in groups)
        targets = _target_counts(total)
        counts = {name: 0 for name in SPLIT_NAMES}
        for group in groups:
            choices = []
            for split in SPLIT_NAMES:
                after = counts[split] + len(group)
                target = max(targets[split], 1)
                relative_error = abs(after - targets[split]) / target
                overflow = max(0, after - targets[split]) / target
                choices.append((overflow, relative_error, counts[split] / target, SPLIT_NAMES.index(split), split))
            chosen = min(choices)[-1]
            counts[chosen] += len(group)
            for record in group:
                assignment[record["sha256"]] = chosen
    return assignment


def prepare_dataset(raw_dir: Path, audit_report_path: Path, output_dir: Path, seed: int = SEED) -> dict[str, Any]:
    raw_dir = raw_dir.resolve()
    audit_report_path = audit_report_path.resolve()
    output_dir = output_dir.resolve()
    if not raw_dir.is_dir():
        raise FileNotFoundError(f"Raw dataset directory does not exist: {raw_dir}")
    if not audit_report_path.is_file():
        raise FileNotFoundError(f"Audit duplicate report does not exist: {audit_report_path}")
    if output_dir.exists():
        raise FileExistsError(f"Output already exists; refusing to overwrite: {output_dir}")

    existing_classes = {path.name for path in raw_dir.iterdir() if path.is_dir()}
    missing_classes = sorted(set(CLASS_MAPPING) - existing_classes)
    if missing_classes:
        raise ValueError(f"Missing expected target class folders: {missing_classes}")

    review_rows, excluded_cross_class_paths = _read_duplicate_review(raw_dir, audit_report_path)
    verification_rows: list[dict[str, Any]] = []
    excluded_rows: list[dict[str, str]] = []
    records_by_class_hash: dict[str, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))

    for original_class in CLASS_MAPPING:
        class_dir = raw_dir / original_class
        for source in sorted(
            (path for path in class_dir.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS),
            key=lambda path: path.as_posix().casefold(),
        ):
            relative_path = source.relative_to(raw_dir).as_posix()
            crop, display_label = CLASS_MAPPING[original_class]
            try:
                detected_format, width, height = _verify_image(source)
                digest = sha256_file(source)
                aspect_ratio = width / height
                issues = []
                if min(width, height) < MINIMUM_DIMENSION:
                    issues.append("unusually_small")
                if aspect_ratio < MINIMUM_ASPECT_RATIO or aspect_ratio > MAXIMUM_ASPECT_RATIO:
                    issues.append("unusual_aspect_ratio")
                expected_extensions = {"JPEG": {".jpg", ".jpeg"}, "PNG": {".png"}, "WEBP": {".webp"}}
                mismatch = source.suffix.lower() not in expected_extensions.get(detected_format, {source.suffix.lower()})
                record = {
                    "source": source,
                    "source_relative_path": relative_path,
                    "original_class": original_class,
                    "crop": crop,
                    "display_label": display_label,
                    "sha256": digest,
                    "format": detected_format,
                    "width": width,
                    "height": height,
                    "aspect_ratio": round(aspect_ratio, 6),
                    "unusually_small": min(width, height) < MINIMUM_DIMENSION,
                    "unusual_aspect_ratio": aspect_ratio < MINIMUM_ASPECT_RATIO or aspect_ratio > MAXIMUM_ASPECT_RATIO,
                    "extension_mismatch": mismatch,
                    "warnings": ";".join(issues + (["extension_content_mismatch"] if mismatch else [])),
                }
                verification_rows.append({
                    "source_relative_path": relative_path,
                    "original_class": original_class,
                    "display_label": display_label,
                    "decoded": True,
                    "detected_format": detected_format,
                    "extension": source.suffix.lower(),
                    "extension_content_mismatch": mismatch,
                    "width": width,
                    "height": height,
                    "aspect_ratio": round(aspect_ratio, 6),
                    "unusually_small": record["unusually_small"],
                    "unusual_aspect_ratio": record["unusual_aspect_ratio"],
                    "sha256": digest,
                    "error": "",
                })
                if relative_path in excluded_cross_class_paths:
                    excluded_rows.append({
                        "source_relative_path": relative_path,
                        "original_class": original_class,
                        "sha256": digest,
                        "reason": "ambiguous_cross_class_duplicate_requires_human_label_review",
                    })
                else:
                    records_by_class_hash[original_class][digest].append(record)
            except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
                verification_rows.append({
                    "source_relative_path": relative_path,
                    "original_class": original_class,
                    "display_label": display_label,
                    "decoded": False,
                    "detected_format": "",
                    "extension": source.suffix.lower(),
                    "extension_content_mismatch": "",
                    "width": "",
                    "height": "",
                    "aspect_ratio": "",
                    "unusually_small": "",
                    "unusual_aspect_ratio": "",
                    "sha256": "",
                    "error": f"{type(exc).__name__}: {exc}",
                })
                excluded_rows.append({
                    "source_relative_path": relative_path,
                    "original_class": original_class,
                    "sha256": "",
                    "reason": f"unreadable_or_hash_error: {type(exc).__name__}: {exc}",
                })

    # Exact copies of a file in the same class form one atomic split unit.
    groups_by_class: dict[str, list[list[dict[str, Any]]]] = {}
    for original_class, by_hash in records_by_class_hash.items():
        groups_by_class[original_class] = list(by_hash.values())
    split_by_hash = assign_grouped_splits(groups_by_class, seed)

    manifest_rows: dict[str, list[dict[str, Any]]] = {name: [] for name in SPLIT_NAMES}
    split_counts: dict[str, Counter[str]] = {name: Counter() for name in SPLIT_NAMES}
    split_hashes: dict[str, set[str]] = {name: set() for name in SPLIT_NAMES}
    for original_class in CLASS_MAPPING:
        crop, display_label = CLASS_MAPPING[original_class]
        for digest, group in records_by_class_hash[original_class].items():
            split = split_by_hash[digest]
            split_hashes[split].add(digest)
            for record in group:
                prepared_relative = Path("images") / split / Path(record["source_relative_path"])
                destination = output_dir / prepared_relative
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(record["source"], destination)
                if destination.stat().st_size != record["source"].stat().st_size or sha256_file(destination) != digest:
                    raise IOError(f"Prepared copy did not match raw image: {record['source']}")
                split_counts[split][original_class] += 1
                manifest_rows[split].append({
                    "source_relative_path": record["source_relative_path"],
                    "source_path": str(record["source"]),
                    "prepared_relative_path": prepared_relative.as_posix(),
                    "original_class": original_class,
                    "crop": crop,
                    "display_label": display_label,
                    "sha256": digest,
                    "format": record["format"],
                    "width": record["width"],
                    "height": record["height"],
                    "aspect_ratio": record["aspect_ratio"],
                    "unusually_small": record["unusually_small"],
                    "unusual_aspect_ratio": record["unusual_aspect_ratio"],
                    "extension_mismatch": record["extension_mismatch"],
                    "split": split,
                })

    if not all(split_hashes[left].isdisjoint(split_hashes[right]) for left, right in (
        ("train", "validation"), ("train", "test"), ("validation", "test")
    )):
        raise AssertionError("An exact duplicate hash crossed dataset splits")
    for original_class in CLASS_MAPPING:
        if any(split_counts[split][original_class] == 0 for split in SPLIT_NAMES):
            raise ValueError(f"Class {original_class!r} lacks samples in at least one split")

    report_dir = output_dir / "reports"
    manifest_dir = output_dir / "manifests"
    report_dir.mkdir(parents=True, exist_ok=True)
    manifest_dir.mkdir(parents=True, exist_ok=True)

    mapping_rows = [
        {"crop": crop, "original_class_folder": original, "display_label": display}
        for original, (crop, display) in CLASS_MAPPING.items()
    ]
    write_csv(report_dir / "class_mapping.csv", ["crop", "original_class_folder", "display_label"], mapping_rows)
    verification_fields = [
        "source_relative_path", "original_class", "display_label", "decoded", "detected_format",
        "extension", "extension_content_mismatch", "width", "height", "aspect_ratio",
        "unusually_small", "unusual_aspect_ratio", "sha256", "error",
    ]
    write_csv(report_dir / "image_verification.csv", verification_fields, verification_rows)
    (report_dir / "image_verification.json").write_text(json.dumps({
        "raw_dir": str(raw_dir),
        "decoder": f"Pillow {PIL.__version__}; each image verified and fully loaded",
        "images_checked": len(verification_rows),
        "unreadable_images": sum(not row["decoded"] for row in verification_rows),
        "unusually_small_images": sum(row["unusually_small"] is True for row in verification_rows),
        "unusual_aspect_ratio_images": sum(row["unusual_aspect_ratio"] is True for row in verification_rows),
        "extension_content_mismatches": sum(row["extension_content_mismatch"] is True for row in verification_rows),
        "size_threshold_pixels": MINIMUM_DIMENSION,
        "aspect_ratio_threshold": {"minimum": MINIMUM_ASPECT_RATIO, "maximum": MAXIMUM_ASPECT_RATIO},
        "images": verification_rows,
    }, indent=2), encoding="utf-8")

    review_fields = [
        "sha256", "original_class_labels", "filenames", "verified_against_raw",
        "includes_target_crop", "target_files_excluded", "decision",
    ]
    write_csv(report_dir / "cross_class_duplicate_review.csv", review_fields, review_rows)
    (report_dir / "cross_class_duplicate_review.json").write_text(json.dumps({
        "review_policy": "No label was selected as correct. Target-crop copies in cross-class groups are excluded pending human review.",
        "groups_reviewed": len(review_rows),
        "groups_verified": sum(row["verified_against_raw"] for row in review_rows),
        "target_groups_excluded": sum(bool(row["target_files_excluded"]) for row in review_rows),
        "groups": review_rows,
    }, indent=2), encoding="utf-8")

    manifest_fields = [
        "source_relative_path", "source_path", "prepared_relative_path", "original_class",
        "crop", "display_label", "sha256", "format", "width", "height", "aspect_ratio",
        "unusually_small", "unusual_aspect_ratio", "extension_mismatch", "split",
    ]
    for split in SPLIT_NAMES:
        manifest_rows[split].sort(key=lambda row: (row["original_class"].casefold(), row["source_relative_path"].casefold()))
        write_csv(manifest_dir / f"{split}.csv", manifest_fields, manifest_rows[split])

    class_distribution_rows = []
    for original_class, (crop, display_label) in CLASS_MAPPING.items():
        row = {
            "crop": crop,
            "original_class_folder": original_class,
            "display_label": display_label,
            "train": split_counts["train"][original_class],
            "validation": split_counts["validation"][original_class],
            "test": split_counts["test"][original_class],
            "total": sum(split_counts[split][original_class] for split in SPLIT_NAMES),
        }
        class_distribution_rows.append(row)
    write_csv(
        report_dir / "split_class_distribution.csv",
        ["crop", "original_class_folder", "display_label", "train", "validation", "test", "total"],
        class_distribution_rows,
    )
    (report_dir / "split_class_distribution.json").write_text(json.dumps({
        "seed": seed,
        "requested_split_ratios": SPLIT_RATIOS,
        "grouping_policy": "Images with identical SHA-256 hashes in the same class are assigned together.",
        "class_distribution": class_distribution_rows,
        "split_totals": {split: sum(split_counts[split].values()) for split in SPLIT_NAMES},
    }, indent=2), encoding="utf-8")

    write_csv(
        report_dir / "exclusion_report.csv",
        ["source_relative_path", "original_class", "sha256", "reason"],
        excluded_rows,
    )
    (report_dir / "exclusion_summary.json").write_text(json.dumps({
        "excluded_image_count": len(excluded_rows),
        "by_reason": dict(Counter(row["reason"].split(":")[0] for row in excluded_rows)),
        "images": excluded_rows,
    }, indent=2), encoding="utf-8")

    return {
        "raw_dir": str(raw_dir),
        "output_dir": str(output_dir),
        "classes": len(CLASS_MAPPING),
        "images_verified": len(verification_rows),
        "unreadable_images": sum(not row["decoded"] for row in verification_rows),
        "unusually_small_images": sum(row["unusually_small"] is True for row in verification_rows),
        "unusual_aspect_ratio_images": sum(row["unusual_aspect_ratio"] is True for row in verification_rows),
        "extension_content_mismatches": sum(row["extension_content_mismatch"] is True for row in verification_rows),
        "cross_class_groups_reviewed": len(review_rows),
        "cross_class_target_images_excluded": len(excluded_cross_class_paths),
        "other_images_excluded": len(excluded_rows) - len(excluded_cross_class_paths),
        "split_totals": {split: sum(split_counts[split].values()) for split in SPLIT_NAMES},
        "split_class_counts": {split: dict(split_counts[split]) for split in SPLIT_NAMES},
        "output_files": sorted(str(path) for path in output_dir.rglob("*") if path.is_file()),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    root = Path(__file__).parent
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=root / "datasets" / "plant_disease" / "raw" / "15 Crop 45 Disease and Healthy Leaf dataset",
    )
    parser.add_argument(
        "--audit-duplicate-report",
        type=Path,
        default=root / "reports" / "plant_disease_audit" / "duplicate_report.json",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=root / "datasets" / "plant_disease" / "prepared_v1",
    )
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()
    result = prepare_dataset(args.raw_dir, args.audit_duplicate_report, args.output_dir, args.seed)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
