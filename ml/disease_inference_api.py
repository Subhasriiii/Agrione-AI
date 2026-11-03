#!/usr/bin/env python3
"""FastAPI inference service for AgriOne's V1 plant-disease classifier.

Run from the project root after installing ml/requirements-disease-inference.txt:
    python -m uvicorn ml.disease_inference_api:app --host 127.0.0.1 --port 8001

The checkpoint path can be overridden with DISEASE_MODEL_CHECKPOINT. The
minimum accepted confidence can be configured with DISEASE_MIN_CONFIDENCE
(default: 0.70). Checkpoint files must be trusted local artifacts.
"""

from __future__ import annotations

import inspect
import io
import os
import warnings
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from torch import nn
from torchvision.models import mobilenet_v3_small


ROOT = Path(__file__).resolve().parent
DEFAULT_CHECKPOINT = ROOT / "models" / "plant_disease" / "mobilenet_v3_small_best.pt"
IMAGE_SIZE = 160
CLASS_COUNT = 18
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MIN_CONFIDENCE_DEFAULT = 0.70
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
ALLOWED_IMAGE_FORMATS = {"BMP", "GIF", "JPEG", "PNG", "TIFF", "WEBP"}


@dataclass(frozen=True)
class InferenceModel:
    model: nn.Module
    device: torch.device
    image_size: int
    class_to_index: dict[str, int]
    class_metadata: dict[str, dict[str, str]]
    min_confidence: float


def _configured_min_confidence() -> float:
    raw_value = os.environ.get("DISEASE_MIN_CONFIDENCE", str(MIN_CONFIDENCE_DEFAULT))
    try:
        threshold = float(raw_value)
    except ValueError as exc:
        raise ValueError("DISEASE_MIN_CONFIDENCE must be a number from 0 to 1") from exc
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("DISEASE_MIN_CONFIDENCE must be between 0 and 1")
    return threshold


def _load_checkpoint(path: Path, device: torch.device) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"Disease model checkpoint not found: {path}")

    load_options: dict[str, Any] = {"map_location": device}
    if "weights_only" in inspect.signature(torch.load).parameters:
        load_options["weights_only"] = True
    else:
        # Older PyTorch releases lack weights_only; only load a trusted local checkpoint.
        load_options["weights_only"] = False

    checkpoint = torch.load(path, **load_options)
    if not isinstance(checkpoint, dict):
        raise ValueError("Checkpoint must contain a dictionary")
    required_keys = {
        "model_state_dict",
        "model_config",
        "class_to_index",
        "class_metadata",
    }
    missing_keys = required_keys - checkpoint.keys()
    if missing_keys:
        raise ValueError(f"Checkpoint is missing required keys: {sorted(missing_keys)}")
    return checkpoint


def _validate_class_mapping(
    class_to_index: Any,
    class_metadata: Any,
    model_config: Any,
) -> tuple[dict[str, int], dict[str, dict[str, str]]]:
    if not isinstance(class_to_index, dict) or len(class_to_index) != CLASS_COUNT:
        raise ValueError(f"Checkpoint must contain exactly {CLASS_COUNT} classes")
    if any(not isinstance(name, str) or not name.strip() for name in class_to_index):
        raise ValueError("Checkpoint class names must be non-empty strings")
    if any(type(index) is not int for index in class_to_index.values()):
        raise ValueError("Checkpoint class indices must be integers")
    if set(class_to_index.values()) != set(range(CLASS_COUNT)):
        raise ValueError("Checkpoint class indices must be contiguous from 0 to 17")

    if not isinstance(class_metadata, dict) or set(class_metadata) != set(class_to_index):
        raise ValueError("Checkpoint class metadata must match its class_to_index keys")
    validated_metadata: dict[str, dict[str, str]] = {}
    for class_name, values in class_metadata.items():
        if not isinstance(values, dict):
            raise ValueError(f"Metadata for {class_name!r} must be a dictionary")
        crop = values.get("crop")
        display_label = values.get("display_label")
        if not isinstance(crop, str) or not crop.strip():
            raise ValueError(f"Metadata for {class_name!r} has no valid crop")
        if not isinstance(display_label, str) or not display_label.strip():
            raise ValueError(f"Metadata for {class_name!r} has no valid display_label")
        validated_metadata[class_name] = {"crop": crop, "display_label": display_label}

    if not isinstance(model_config, dict):
        raise ValueError("Checkpoint model_config must be a dictionary")
    if model_config.get("architecture") != "mobilenet_v3_small":
        raise ValueError("Checkpoint architecture is not mobilenet_v3_small")
    if model_config.get("class_to_index") != class_to_index:
        raise ValueError("model_config class mapping differs from the checkpoint class_to_index")
    image_size = model_config.get("image_size")
    if type(image_size) is not int or image_size != IMAGE_SIZE:
        raise ValueError(f"Checkpoint image_size must be {IMAGE_SIZE}")

    return dict(class_to_index), validated_metadata


def load_inference_model(
    checkpoint_path: Path = DEFAULT_CHECKPOINT,
    device: torch.device | None = None,
    min_confidence: float | None = None,
) -> InferenceModel:
    """Load and validate the trusted checkpoint once for application startup."""
    selected_device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = _load_checkpoint(checkpoint_path, selected_device)
    class_to_index, class_metadata = _validate_class_mapping(
        checkpoint["class_to_index"],
        checkpoint["class_metadata"],
        checkpoint["model_config"],
    )

    model = mobilenet_v3_small(weights=None)
    final_layer = model.classifier[-1]
    if not isinstance(final_layer, nn.Linear):
        raise RuntimeError("Unexpected MobileNetV3-Small classifier layout")
    model.classifier[-1] = nn.Linear(final_layer.in_features, CLASS_COUNT)
    model.load_state_dict(checkpoint["model_state_dict"], strict=True)
    model = model.to(selected_device)
    model.eval()

    threshold = _configured_min_confidence() if min_confidence is None else min_confidence
    if not 0.0 <= threshold <= 1.0:
        raise ValueError("Minimum confidence must be between 0 and 1")
    return InferenceModel(
        model=model,
        device=selected_device,
        image_size=checkpoint["model_config"]["image_size"],
        class_to_index=class_to_index,
        class_metadata=class_metadata,
        min_confidence=threshold,
    )


def preprocess_image(image_bytes: bytes, image_size: int = IMAGE_SIZE) -> torch.Tensor:
    """Apply the training-time RGB, contain, center-pad and normalization pipeline."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(image_bytes)) as source:
                if source.format not in ALLOWED_IMAGE_FORMATS:
                    raise ValueError("Unsupported image format")
                source.load()
                image = source.convert("RGB")
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning,
            UnidentifiedImageError) as exc:
        raise ValueError("Could not decode a supported image") from exc

    image = ImageOps.contain(
        image,
        (image_size, image_size),
        method=Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGB", (image_size, image_size), (0, 0, 0))
    canvas.paste(
        image,
        ((image_size - image.width) // 2, (image_size - image.height) // 2),
    )

    pixels = np.asarray(canvas, dtype=np.float32) / 255.0
    tensor = torch.from_numpy(pixels).permute(2, 0, 1)
    mean = torch.tensor(IMAGENET_MEAN, dtype=tensor.dtype).view(3, 1, 1)
    std = torch.tensor(IMAGENET_STD, dtype=tensor.dtype).view(3, 1, 1)
    return (tensor - mean) / std


def predict_tensor(tensor: torch.Tensor, inference: InferenceModel) -> dict[str, Any]:
    """Return one thresholded prediction and its three highest softmax scores."""
    batch = tensor.unsqueeze(0).to(inference.device)
    with torch.inference_mode():
        probabilities = torch.softmax(inference.model(batch), dim=1)[0].cpu()
    top_probabilities, top_indices = torch.topk(probabilities, k=3)
    top_predictions = []
    for score, index in zip(top_probabilities.tolist(), top_indices.tolist()):
        class_name = next(name for name, value in inference.class_to_index.items() if value == index)
        metadata = inference.class_metadata[class_name]
        top_predictions.append({
            "class": class_name,
            "disease_name": metadata["display_label"],
            "crop": metadata["crop"],
            "confidence": float(score),
        })

    best = top_predictions[0]
    accepted = best["confidence"] >= inference.min_confidence
    return {
        "success": True,
        "predicted_class": best["class"] if accepted else None,
        "disease_name": best["disease_name"] if accepted else None,
        "crop": best["crop"] if accepted else None,
        "confidence": best["confidence"],
        "model_version": "V1",
        "model_status": "predicted" if accepted else "uncertain",
        "top_predictions": top_predictions,
        "disclaimer": (
            "This is a model prediction among its 18 trained classes, not a confirmed diagnosis. "
            "Confidence is a softmax score, not a calibrated probability or guarantee of accuracy."
        ),
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    checkpoint_path = Path(os.environ.get("DISEASE_MODEL_CHECKPOINT", str(DEFAULT_CHECKPOINT))).expanduser()
    app.state.inference_model = load_inference_model(checkpoint_path)
    yield
    del app.state.inference_model


app = FastAPI(
    title="AgriOne AI Plant Disease Inference API",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
def health(request: Request) -> dict[str, Any]:
    inference: InferenceModel = request.app.state.inference_model
    return {
        "status": "healthy",
        "model_loaded": True,
        "model_version": "V1",
        "device": str(inference.device),
        "class_count": len(inference.class_to_index),
        "image_size": inference.image_size,
        "minimum_confidence": inference.min_confidence,
    }


@app.post("/predict")
async def predict(request: Request, file: UploadFile = File(...)) -> dict[str, Any]:
    if file.content_type and not (
        file.content_type.lower().startswith("image/")
        or file.content_type.lower() == "application/octet-stream"
    ):
        await file.close()
        raise HTTPException(status_code=415, detail="Upload must be an image")

    try:
        image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    finally:
        await file.close()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image must be no larger than 5 MB")

    try:
        image_tensor = preprocess_image(image_bytes, request.app.state.inference_model.image_size)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    inference: InferenceModel = request.app.state.inference_model
    return predict_tensor(image_tensor, inference)
