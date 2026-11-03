#!/usr/bin/env python3
"""Train or explicitly evaluate an AgriOne plant-disease MobileNetV3-Small model."""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import random
import sys
import tempfile
import time
import warnings
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image, ImageOps, UnidentifiedImageError
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small


SEED = 42
IMAGE_SIZE = 160
BATCH_SIZE = 2
NUM_WORKERS = 2
EARLY_STOPPING_PATIENCE = 5
DEFAULT_EPOCHS = 30
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
REQUIRED_MANIFEST_COLUMNS = {
    "prepared_relative_path",
    "original_class",
    "split",
}


class TrainingDataError(ValueError):
    """Raised when a manifest or its referenced image is invalid."""


@dataclass(frozen=True)
class ManifestRow:
    image_path: Path
    original_class: str
    class_index: int


def _read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    if not path.is_file():
        raise FileNotFoundError(f"Required CSV file does not exist: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise TrainingDataError(f"CSV has no header: {path}")
        return list(reader.fieldnames), list(reader)


def _load_class_mapping(mapping_path: Path) -> tuple[dict[str, int], dict[str, dict[str, str]]]:
    fieldnames, rows = _read_csv(mapping_path)
    required = {"crop", "original_class_folder", "display_label"}
    if not required.issubset(fieldnames):
        raise TrainingDataError(
            f"Class mapping is missing columns {sorted(required - set(fieldnames))}: {mapping_path}"
        )
    metadata: dict[str, dict[str, str]] = {}
    for row in rows:
        original = row["original_class_folder"].strip()
        if not original or original in metadata:
            raise TrainingDataError(f"Empty or duplicate original class name in {mapping_path}: {original!r}")
        metadata[original] = {
            "crop": row["crop"].strip(),
            "display_label": row["display_label"].strip(),
        }
    if not metadata:
        raise TrainingDataError(f"No classes found in {mapping_path}")
    names = list(metadata)
    return {name: index for index, name in enumerate(names)}, metadata


def _manifest_rows(
    manifest_path: Path,
    prepared_dir: Path,
    class_to_index: dict[str, int],
    expected_split: str,
) -> tuple[list[ManifestRow], Counter[str]]:
    fieldnames, rows = _read_csv(manifest_path)
    if not REQUIRED_MANIFEST_COLUMNS.issubset(fieldnames):
        raise TrainingDataError(
            f"{manifest_path} is missing columns {sorted(REQUIRED_MANIFEST_COLUMNS - set(fieldnames))}"
        )
    resolved_root = prepared_dir.resolve()
    parsed: list[ManifestRow] = []
    counts: Counter[str] = Counter()
    for line_number, row in enumerate(rows, start=2):
        class_name = row.get("original_class", "").strip()
        if class_name not in class_to_index:
            raise TrainingDataError(
                f"Invalid class label {class_name!r} in {manifest_path}, line {line_number}"
            )
        manifest_split = row.get("split", "").strip()
        if manifest_split != expected_split:
            raise TrainingDataError(
                f"Expected split {expected_split!r}, got {manifest_split!r} "
                f"in {manifest_path}, line {line_number}"
            )
        relative = Path(row.get("prepared_relative_path", "").strip())
        if not relative.parts or relative.is_absolute() or ".." in relative.parts:
            raise TrainingDataError(
                f"Invalid prepared_relative_path in {manifest_path}, line {line_number}: {relative}"
            )
        image_path = (prepared_dir / relative).resolve()
        if not image_path.is_relative_to(resolved_root):
            raise TrainingDataError(
                f"Image path escapes prepared dataset in {manifest_path}, line {line_number}: {relative}"
            )
        if not image_path.is_file():
            raise FileNotFoundError(
                f"Manifest image is missing in {manifest_path}, line {line_number}: {image_path}"
            )
        parsed.append(ManifestRow(image_path, class_name, class_to_index[class_name]))
        counts[class_name] += 1
    if not parsed:
        raise TrainingDataError(f"Manifest contains no image rows: {manifest_path}")
    missing_classes = sorted(set(class_to_index) - set(counts))
    if missing_classes:
        raise TrainingDataError(
            f"Manifest {manifest_path} has no examples for classes: {missing_classes}"
        )
    return parsed, counts


def _check_train_validation_hash_leakage(train_path: Path, validation_path: Path) -> None:
    def read_hashes(path: Path) -> set[str]:
        fields, rows = _read_csv(path)
        if "sha256" not in fields:
            raise TrainingDataError(f"Manifest has no sha256 column: {path}")
        return {row["sha256"].strip() for row in rows if row["sha256"].strip()}

    overlap = read_hashes(train_path) & read_hashes(validation_path)
    if overlap:
        raise TrainingDataError(
            f"Detected {len(overlap)} exact image hashes shared between train and validation manifests"
        )


class PlantDiseaseDataset(Dataset[tuple[torch.Tensor, int]]):
    """Keep only manifest metadata in memory and decode one image per item."""

    def __init__(
        self,
        rows: list[ManifestRow],
        image_size: int,
        training: bool = False,
    ) -> None:
        self.rows = rows
        self.image_size = image_size
        self.training = training

    def __len__(self) -> int:
        return len(self.rows)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, int]:
        row = self.rows[index]
        try:
            with Image.open(row.image_path) as source:
                source.load()
                image = source.convert("RGB")
        except (OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
            raise TrainingDataError(f"Could not decode image {row.image_path}: {exc}") from exc

        image = ImageOps.contain(image, (self.image_size, self.image_size), method=Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (self.image_size, self.image_size), (0, 0, 0))
        canvas.paste(image, ((self.image_size - image.width) // 2, (self.image_size - image.height) // 2))
        if self.training and random.random() < 0.5:
            canvas = ImageOps.mirror(canvas)

        pixels = np.asarray(canvas, dtype=np.float32) / 255.0
        tensor = torch.from_numpy(pixels).permute(2, 0, 1)
        mean = torch.tensor(IMAGENET_MEAN, dtype=tensor.dtype).view(3, 1, 1)
        std = torch.tensor(IMAGENET_STD, dtype=tensor.dtype).view(3, 1, 1)
        return (tensor - mean) / std, row.class_index


def _make_model(class_count: int, pretrained: bool) -> tuple[nn.Module, bool, str | None]:
    if pretrained:
        weights = MobileNet_V3_Small_Weights.DEFAULT
        model = mobilenet_v3_small(weights=weights)
        pretrained_loaded = True
        weights_name = str(weights)
    else:
        model = mobilenet_v3_small(weights=None)
        pretrained_loaded = False
        weights_name = "none"
    final_layer = model.classifier[-1]
    if not isinstance(final_layer, nn.Linear):
        raise RuntimeError("Unexpected MobileNetV3-Small classifier layout")
    model.classifier[-1] = nn.Linear(final_layer.in_features, class_count)
    return model, pretrained_loaded, weights_name


def _set_transfer_learning_mode(model: nn.Module, unfreeze_backbone: bool) -> None:
    for parameter in model.parameters():
        parameter.requires_grad = unfreeze_backbone
    for parameter in model.classifier[-1].parameters():
        parameter.requires_grad = True


def _metrics(confusion: torch.Tensor, class_names: list[str]) -> dict[str, Any]:
    matrix = confusion.to(dtype=torch.float64)
    true_positive = matrix.diag()
    support = matrix.sum(dim=1)
    predicted = matrix.sum(dim=0)
    precision = torch.where(predicted > 0, true_positive / predicted, torch.zeros_like(predicted))
    recall = torch.where(support > 0, true_positive / support, torch.zeros_like(support))
    denominator = precision + recall
    f1 = torch.where(denominator > 0, 2 * precision * recall / denominator, torch.zeros_like(denominator))
    total = matrix.sum().item()
    return {
        "accuracy": float(true_positive.sum().item() / total) if total else 0.0,
        "macro_f1": float(f1.mean().item()) if f1.numel() else 0.0,
        "per_class": [
            {
                "class": class_names[index],
                "precision": float(precision[index].item()),
                "recall": float(recall[index].item()),
                "f1": float(f1[index].item()),
                "support": int(support[index].item()),
            }
            for index in range(len(class_names))
        ],
        "confusion_matrix": matrix.to(dtype=torch.int64).tolist(),
    }


def _run_epoch(
    model: nn.Module,
    loader: DataLoader[tuple[torch.Tensor, int]],
    criterion: nn.Module,
    device: torch.device,
    class_names: list[str],
    optimizer: torch.optim.Optimizer | None,
    epoch_label: str,
) -> tuple[float, dict[str, Any]]:
    training = optimizer is not None
    model.train(training)
    total_loss = 0.0
    total_examples = 0
    class_count = len(class_names)
    confusion = torch.zeros((class_count, class_count), dtype=torch.int64)
    context = torch.enable_grad() if training else torch.inference_mode()
    with context:
        for batch_index, (images, targets) in enumerate(loader, start=1):
            images = images.to(device)
            targets = targets.to(device)
            if optimizer is not None:
                optimizer.zero_grad(set_to_none=True)
            logits = model(images)
            loss = criterion(logits, targets)
            if optimizer is not None:
                loss.backward()
                optimizer.step()

            batch_size = targets.size(0)
            total_loss += float(loss.detach().item()) * batch_size
            total_examples += batch_size
            predictions = logits.detach().argmax(dim=1)
            indices = targets.detach() * class_count + predictions
            confusion += torch.bincount(indices.cpu(), minlength=class_count * class_count).reshape(
                class_count, class_count
            )
            if batch_index == 1 or batch_index % 100 == 0 or batch_index == len(loader):
                print(
                    f"{epoch_label}: batch {batch_index}/{len(loader)} "
                    f"({min(batch_index * loader.batch_size, len(loader.dataset))}/{len(loader.dataset)} images)",
                    flush=True,
                )
    average_loss = total_loss / max(total_examples, 1)
    return average_loss, _metrics(confusion, class_names)


def _atomic_torch_save(value: dict[str, Any], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", suffix=".tmp", dir=destination.parent)
    os.close(descriptor)
    temporary_path = Path(temporary_name)
    try:
        torch.save(value, temporary_path)
        os.replace(temporary_path, destination)
    finally:
        temporary_path.unlink(missing_ok=True)


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def _write_history(history: list[dict[str, Any]], report_dir: Path) -> None:
    _write_json(report_dir / "training_history.json", history)
    fields = [
        "epoch", "train_loss", "train_accuracy", "train_macro_f1",
        "validation_loss", "validation_accuracy", "validation_macro_f1",
        "learning_rate", "seconds",
    ]
    with (report_dir / "training_history.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(history)


def _save_test_metrics(metrics: dict[str, Any], report_dir: Path, class_names: list[str]) -> None:
    _write_json(report_dir / "test_evaluation.json", metrics)
    with (report_dir / "test_per_class_metrics.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        fields = ["class", "precision", "recall", "f1", "support"]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(metrics["per_class"])
    with (report_dir / "test_confusion_matrix.csv").open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(["actual/predicted", *class_names])
        for class_name, row in zip(class_names, metrics["confusion_matrix"], strict=True):
            writer.writerow([class_name, *row])


def _safe_torch_load(path: Path, device: torch.device) -> dict[str, Any]:
    try:
        checkpoint = torch.load(path, map_location=device, weights_only=False)
    except TypeError:
        checkpoint = torch.load(path, map_location=device)
    if not isinstance(checkpoint, dict):
        raise TrainingDataError(f"Checkpoint has an invalid format: {path}")
    return checkpoint


def _is_out_of_memory(exc: BaseException) -> bool:
    return isinstance(exc, MemoryError) or (
        isinstance(exc, RuntimeError) and "out of memory" in str(exc).casefold()
    )


def train(args: argparse.Namespace) -> None:
    prepared_dir: Path = args.prepared_dir.resolve()
    model_dir: Path = args.model_dir.resolve()
    report_dir: Path = args.report_dir.resolve()
    mapping_path = prepared_dir / "reports" / "class_mapping.csv"
    class_to_index, class_metadata = _load_class_mapping(mapping_path)
    train_manifest = prepared_dir / "manifests" / "train.csv"
    validation_manifest = prepared_dir / "manifests" / "validation.csv"
    _check_train_validation_hash_leakage(train_manifest, validation_manifest)
    train_rows, train_counts = _manifest_rows(train_manifest, prepared_dir, class_to_index, "train")
    validation_rows, _ = _manifest_rows(validation_manifest, prepared_dir, class_to_index, "validation")

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    torch.use_deterministic_algorithms(True, warn_only=True)
    generator = torch.Generator().manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    class_names = [name for name, _ in sorted(class_to_index.items(), key=lambda item: item[1])]
    train_dataset = PlantDiseaseDataset(train_rows, args.image_size, training=True)
    validation_dataset = PlantDiseaseDataset(validation_rows, args.image_size, training=False)
    loader_options = {
        "batch_size": args.batch_size,
        "num_workers": args.num_workers,
        "pin_memory": device.type == "cuda",
    }
    train_loader = DataLoader(train_dataset, shuffle=True, generator=generator, **loader_options)
    validation_loader = DataLoader(validation_dataset, shuffle=False, **loader_options)
    class_weights = torch.tensor(
        [len(train_rows) / (len(class_names) * train_counts[name]) for name in class_names],
        dtype=torch.float32,
        device=device,
    )
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    model_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    best_path = model_dir / "mobilenet_v3_small_best.pt"
    last_path = model_dir / "mobilenet_v3_small_last.pt"
    history: list[dict[str, Any]] = []
    best_validation_loss = math.inf
    best_epoch = 0
    epochs_without_improvement = 0
    start_epoch = 1
    resume_checkpoint: dict[str, Any] | None = None
    if args.resume:
        if not last_path.is_file():
            raise FileNotFoundError(f"Cannot resume; no last checkpoint exists: {last_path}")
        resume_checkpoint = _safe_torch_load(last_path, device)
        if resume_checkpoint.get("model_config", {}).get("class_to_index") != class_to_index:
            raise TrainingDataError("Resume checkpoint class mapping differs from the prepared dataset")
        model, _, _ = _make_model(len(class_names), pretrained=False)
        model.load_state_dict(resume_checkpoint["model_state_dict"])
        saved_config = resume_checkpoint.get("model_config", {})
        pretrained_loaded = bool(saved_config.get("pretrained_loaded"))
        weights_name = str(saved_config.get("pretrained_weights", "none"))
        pretrained_error = saved_config.get("pretrained_error")
    else:
        pretrained_loaded = False
        weights_name = "none"
        pretrained_error: str | None = None
        try:
            model, pretrained_loaded, weights_name = _make_model(len(class_names), pretrained=True)
        except Exception as exc:
            pretrained_error = f"{type(exc).__name__}: {exc}"
            model, _, _ = _make_model(len(class_names), pretrained=False)
            status = {
                "pretrained_loaded": False,
                "weights": str(MobileNet_V3_Small_Weights.DEFAULT),
                "error": pretrained_error,
                "random_initialization_allowed": bool(args.allow_random_init),
            }
            _write_json(report_dir / "pretrained_weights_status.json", status)
            print(f"Pretrained ImageNet weights were not loaded: {pretrained_error}", file=sys.stderr, flush=True)
            if not args.allow_random_init:
                raise RuntimeError(
                    "Pretrained weights are unavailable. Training was not started. "
                    "Retry when the download is available or explicitly pass --allow-random-init."
                ) from exc
        else:
            _write_json(report_dir / "pretrained_weights_status.json", {
                "pretrained_loaded": True,
                "weights": weights_name,
                "error": None,
                "random_initialization_allowed": False,
            })

    model = model.to(device)
    _set_transfer_learning_mode(model, args.unfreeze_backbone)
    trainable_parameters = [parameter for parameter in model.parameters() if parameter.requires_grad]
    optimizer = torch.optim.AdamW(trainable_parameters, lr=args.learning_rate)

    model_config = {
        "architecture": "mobilenet_v3_small",
        "image_size": args.image_size,
        "batch_size": args.batch_size,
        "num_workers": args.num_workers,
        "normalization": {"mean": IMAGENET_MEAN, "std": IMAGENET_STD},
        "aspect_ratio": "preserved using centered square padding",
        "pretrained_loaded": pretrained_loaded,
        "pretrained_weights": weights_name if pretrained_loaded else "none",
        "pretrained_error": pretrained_error,
        "backbone_unfrozen": args.unfreeze_backbone,
        "class_to_index": class_to_index,
        "class_metadata": class_metadata,
        "seed": args.seed,
        "class_weighted_loss": "inverse frequency: N / (class_count * class_samples)",
        "class_weights": {name: float(class_weights[index].item()) for index, name in enumerate(class_names)},
        "early_stopping_patience": args.patience,
    }
    metadata = {
        "status": "training",
        "device": str(device),
        "python_version": sys.version,
        "torch_version": torch.__version__,
        "torchvision_version": __import__("torchvision").__version__,
        "model_config": model_config,
        "train_samples": len(train_rows),
        "validation_samples": len(validation_rows),
        "train_class_counts": dict(train_counts),
        "test_evaluated": False,
        "test_evaluation_policy": "The test manifest is not read during training.",
    }
    _write_json(report_dir / "training_metadata.json", metadata)

    if resume_checkpoint is not None:
        saved_config = resume_checkpoint.get("model_config", {})
        current_settings = {
            "image_size": args.image_size,
            "batch_size": args.batch_size,
            "backbone_unfrozen": args.unfreeze_backbone,
            "seed": args.seed,
        }
        changed_settings = {
            key: (saved_config.get(key), value)
            for key, value in current_settings.items()
            if saved_config.get(key) != value
        }
        if changed_settings:
            raise TrainingDataError(f"Resume settings differ from checkpoint: {changed_settings}")
        optimizer.load_state_dict(resume_checkpoint["optimizer_state_dict"])
        history = resume_checkpoint.get("history", [])
        best_validation_loss = float(resume_checkpoint.get("best_validation_loss", math.inf))
        best_epoch = int(resume_checkpoint.get("best_epoch", 0))
        epochs_without_improvement = int(resume_checkpoint.get("epochs_without_improvement", 0))
        start_epoch = int(resume_checkpoint.get("epoch", 0)) + 1
        print(f"Resuming after epoch {start_epoch - 1}", flush=True)

    _write_history(history, report_dir)
    _atomic_torch_save({
        "epoch": start_epoch - 1,
        "model_state_dict": model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "model_config": model_config,
        "history": history,
        "best_validation_loss": best_validation_loss,
        "best_epoch": best_epoch,
        "epochs_without_improvement": epochs_without_improvement,
    }, last_path)

    print(
        f"Starting MobileNetV3-Small on {device}: {len(train_rows)} train, "
        f"{len(validation_rows)} validation, {len(class_names)} classes; "
        f"pretrained={pretrained_loaded}, batch_size={args.batch_size}",
        flush=True,
    )
    try:
        for epoch in range(start_epoch, args.epochs + 1):
            epoch_started = time.monotonic()
            print(f"Epoch {epoch}/{args.epochs}", flush=True)
            train_loss, train_metrics = _run_epoch(
                model, train_loader, criterion, device, class_names, optimizer, f"train epoch {epoch}"
            )
            validation_loss, validation_metrics = _run_epoch(
                model, validation_loader, criterion, device, class_names, None, f"validation epoch {epoch}"
            )
            elapsed = time.monotonic() - epoch_started
            entry = {
                "epoch": epoch,
                "train_loss": train_loss,
                "train_accuracy": train_metrics["accuracy"],
                "train_macro_f1": train_metrics["macro_f1"],
                "validation_loss": validation_loss,
                "validation_accuracy": validation_metrics["accuracy"],
                "validation_macro_f1": validation_metrics["macro_f1"],
                "learning_rate": optimizer.param_groups[0]["lr"],
                "seconds": round(elapsed, 2),
            }
            history.append(entry)
            improved = validation_loss < best_validation_loss
            if improved:
                best_validation_loss = validation_loss
                best_epoch = epoch
                epochs_without_improvement = 0
                _atomic_torch_save({
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "model_config": model_config,
                    "class_to_index": class_to_index,
                    "class_metadata": class_metadata,
                    "best_validation_loss": best_validation_loss,
                    "pretrained_loaded": pretrained_loaded,
                    "pretrained_weights": weights_name if pretrained_loaded else "none",
                }, best_path)
            else:
                epochs_without_improvement += 1
            _write_history(history, report_dir)
            _atomic_torch_save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "model_config": model_config,
                "history": history,
                "best_validation_loss": best_validation_loss,
                "best_epoch": best_epoch,
                "epochs_without_improvement": epochs_without_improvement,
            }, last_path)
            print(
                f"epoch={epoch} train_loss={train_loss:.4f} train_acc={train_metrics['accuracy']:.4f} "
                f"train_macro_f1={train_metrics['macro_f1']:.4f} "
                f"val_loss={validation_loss:.4f} val_acc={validation_metrics['accuracy']:.4f} "
                f"val_macro_f1={validation_metrics['macro_f1']:.4f} "
                f"best_epoch={best_epoch} time={elapsed:.1f}s",
                flush=True,
            )
            if epochs_without_improvement >= args.patience:
                print(f"Early stopping after {args.patience} epochs without validation-loss improvement.", flush=True)
                break
    except KeyboardInterrupt:
        metadata.update({"status": "interrupted", "completed_epochs": len(history), "best_epoch": best_epoch})
        _write_json(report_dir / "training_metadata.json", metadata)
        print(
            f"Training interrupted. The last completed epoch is checkpointed at {last_path}; "
            "resume with --resume.",
            file=sys.stderr,
            flush=True,
        )
        return
    except (MemoryError, RuntimeError) as exc:
        if _is_out_of_memory(exc):
            metadata.update({
                "status": "out_of_memory",
                "error": f"{type(exc).__name__}: {exc}",
                "completed_epochs": len(history),
                "best_epoch": best_epoch,
            })
            _write_json(report_dir / "training_metadata.json", metadata)
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            raise RuntimeError(
                f"Training ran out of memory. Last completed epoch is checkpointed at {last_path}. "
                "Retry with --batch-size 1 or close other applications, then use --resume."
            ) from exc
        raise

    metadata.update({
        "status": "completed",
        "completed_epochs": len(history),
        "best_epoch": best_epoch,
        "best_validation_loss": best_validation_loss,
        "best_checkpoint": str(best_path),
        "test_evaluated": False,
    })
    _write_json(report_dir / "training_metadata.json", metadata)
    print(f"Training complete. Best checkpoint: {best_path}", flush=True)


def evaluate_test(args: argparse.Namespace) -> None:
    prepared_dir: Path = args.prepared_dir.resolve()
    checkpoint_path: Path = args.checkpoint.resolve()
    report_dir: Path = args.report_dir.resolve()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"Test evaluation checkpoint does not exist: {checkpoint_path}")
    class_to_index, class_metadata = _load_class_mapping(prepared_dir / "reports" / "class_mapping.csv")
    class_names = [name for name, _ in sorted(class_to_index.items(), key=lambda item: item[1])]
    test_manifest = prepared_dir / "manifests" / "test.csv"
    test_rows, test_counts = _manifest_rows(test_manifest, prepared_dir, class_to_index, "test")
    checkpoint = _safe_torch_load(checkpoint_path, device)
    checkpoint_mapping = checkpoint.get("class_to_index") or checkpoint.get("model_config", {}).get("class_to_index")
    if checkpoint_mapping != class_to_index:
        raise TrainingDataError("Checkpoint class mapping does not match the prepared dataset mapping")
    saved_image_size = checkpoint.get("model_config", {}).get("image_size")
    if not isinstance(saved_image_size, int) or saved_image_size < 32:
        raise TrainingDataError("Checkpoint does not contain a valid training image size")
    if args.image_size is not None and args.image_size != saved_image_size:
        raise TrainingDataError(
            f"Requested image size {args.image_size} differs from checkpoint image size {saved_image_size}"
        )
    evaluation_image_size = args.image_size or saved_image_size
    model, _, _ = _make_model(len(class_names), pretrained=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    model = model.to(device)
    model.eval()
    dataset = PlantDiseaseDataset(test_rows, evaluation_image_size, training=False)
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
    )
    confusion = torch.zeros((len(class_names), len(class_names)), dtype=torch.int64)
    total_loss = 0.0
    total = 0
    with torch.inference_mode():
        for batch_index, (images, targets) in enumerate(loader, start=1):
            images = images.to(device)
            targets = targets.to(device)
            logits = model(images)
            loss = nn.functional.cross_entropy(logits, targets, reduction="sum")
            total_loss += float(loss.item())
            total += targets.size(0)
            predicted = logits.argmax(dim=1)
            indices = (targets * len(class_names) + predicted).cpu()
            confusion += torch.bincount(indices, minlength=len(class_names) ** 2).reshape(
                len(class_names), len(class_names)
            )
            if batch_index == 1 or batch_index % 100 == 0 or batch_index == len(loader):
                print(f"test: batch {batch_index}/{len(loader)} ({total}/{len(test_rows)} images)", flush=True)
    metrics = _metrics(confusion, class_names)
    metrics.update({
        "checkpoint": str(checkpoint_path),
        "checkpoint_epoch": checkpoint.get("epoch"),
        "test_samples": total,
        "test_loss": total_loss / max(total, 1),
        "test_class_counts": dict(test_counts),
        "model_config": checkpoint.get("model_config", {}),
        "class_metadata": class_metadata,
        "test_manifest": str(test_manifest),
        "evaluated_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })
    _save_test_metrics(metrics, report_dir, class_names)
    print(
        f"Test results: loss={metrics['test_loss']:.4f}, accuracy={metrics['accuracy']:.4f}, "
        f"macro_f1={metrics['macro_f1']:.4f}",
        flush=True,
    )


def _parser() -> argparse.ArgumentParser:
    ml_dir = Path(__file__).resolve().parent
    prepared_default = ml_dir / "datasets" / "plant_disease" / "prepared_v1"
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--evaluate-test", action="store_true", help="Explicitly evaluate the test manifest only.")
    parser.add_argument("--prepared-dir", type=Path, default=prepared_default)
    parser.add_argument("--model-dir", type=Path, default=ml_dir / "models" / "plant_disease")
    parser.add_argument("--report-dir", type=Path, default=ml_dir / "reports" / "plant_disease")
    parser.add_argument("--checkpoint", type=Path, help="Checkpoint to load with --evaluate-test.")
    parser.add_argument("--image-size", type=int)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--num-workers", type=int, default=NUM_WORKERS)
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--patience", type=int, default=EARLY_STOPPING_PATIENCE)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--seed", type=int, default=SEED)
    parser.add_argument("--allow-random-init", action="store_true", help="Continue without pretrained weights only when explicitly requested.")
    parser.add_argument("--unfreeze-backbone", action="store_true", help="Fine-tune all layers; requires more memory.")
    parser.add_argument("--resume", action="store_true", help="Resume from the last completed-epoch checkpoint.")
    return parser


def main() -> int:
    parser = _parser()
    args = parser.parse_args()
    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")
    if args.num_workers < 0:
        parser.error("--num-workers must be non-negative")
    if args.image_size is not None and args.image_size < 32:
        parser.error("--image-size must be at least 32")
    if args.epochs < 1 or args.patience < 1:
        parser.error("--epochs and --patience must be at least 1")
    if args.learning_rate <= 0:
        parser.error("--learning-rate must be positive")
    if args.evaluate_test:
        if args.checkpoint is None:
            parser.error("--evaluate-test requires --checkpoint")
        try:
            evaluate_test(args)
        except (OSError, TrainingDataError, RuntimeError) as exc:
            print(f"Test evaluation failed: {exc}", file=sys.stderr)
            return 1
    else:
        if args.checkpoint is not None:
            parser.error("--checkpoint is only valid with --evaluate-test")
        if args.image_size is None:
            args.image_size = IMAGE_SIZE
        try:
            train(args)
        except (OSError, TrainingDataError, RuntimeError, MemoryError) as exc:
            print(f"Training failed: {exc}", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
