#!/usr/bin/env python3
"""Verify checkpoint loading, class metadata, preprocessing, and one prediction.

Run from the project root:
    python ml/verify_disease_inference.py

Optionally provide an image:
    python ml/verify_disease_inference.py --image path/to/leaf.jpg
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from disease_inference_api import (
    DEFAULT_CHECKPOINT,
    ROOT,
    load_inference_model,
    predict_tensor,
    preprocess_image,
)


def _sample_image(prepared_dir: Path) -> Path:
    manifest_path = prepared_dir / "manifests" / "test.csv"
    if not manifest_path.is_file():
        raise FileNotFoundError(
            f"No test manifest found at {manifest_path}; pass --image to select a sample"
        )
    import csv

    with manifest_path.open("r", encoding="utf-8-sig", newline="") as handle:
        row = next(csv.DictReader(handle), None)
    if not row or not row.get("prepared_relative_path"):
        raise ValueError(f"Test manifest has no image rows: {manifest_path}")
    image_path = (prepared_dir / row["prepared_relative_path"]).resolve()
    if not image_path.is_relative_to(prepared_dir.resolve()) or not image_path.is_file():
        raise FileNotFoundError(f"Test manifest image is missing or outside dataset: {image_path}")
    return image_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument(
        "--prepared-dir",
        type=Path,
        default=ROOT / "datasets" / "plant_disease" / "prepared_v1",
    )
    parser.add_argument("--image", type=Path, help="Image to use for the sample inference check")
    args = parser.parse_args()

    inference = load_inference_model(args.checkpoint)
    if len(inference.class_to_index) != 18:
        raise ValueError("Loaded checkpoint does not contain 18 classes")
    if set(inference.class_metadata) != set(inference.class_to_index):
        raise ValueError("Loaded checkpoint class metadata does not match the class mapping")

    image_path = args.image or _sample_image(args.prepared_dir)
    tensor = preprocess_image(image_path.read_bytes(), inference.image_size)
    expected_shape = (3, inference.image_size, inference.image_size)
    if tuple(tensor.shape) != expected_shape:
        raise ValueError(f"Unexpected preprocessed tensor shape: {tuple(tensor.shape)}")

    result = predict_tensor(tensor, inference)
    print(f"Checkpoint loaded: {args.checkpoint}")
    print(f"Device: {inference.device}; classes: {len(inference.class_to_index)}")
    print(f"Mapping and metadata: consistent; tensor shape: {tuple(tensor.shape)}")
    print(f"Sample image: {image_path}")
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError) as exc:
        print(f"Verification failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
