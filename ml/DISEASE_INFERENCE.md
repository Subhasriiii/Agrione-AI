# Plant disease inference service

The standalone FastAPI service loads the V1 checkpoint once at startup and
selects CUDA automatically when available. It defaults to
`ml/models/plant_disease/mobilenet_v3_small_best.pt`.

## Local startup (PowerShell)

Run these commands from the project root:

```powershell
py -m venv .venv-disease
.\.venv-disease\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r ml\requirements-disease-inference.txt
$env:DISEASE_MODEL_CHECKPOINT = (Resolve-Path .\ml\models\plant_disease\mobilenet_v3_small_best.pt).Path
python ml\verify_disease_inference.py
python -m uvicorn ml.disease_inference_api:app --host 127.0.0.1 --port 8001
```

Use a Python release supported by the selected PyTorch release. PyTorch and
torchvision must be installed as a compatible pair; when a CUDA build is
needed, use the official PyTorch installation selector for the machine's CUDA
runtime. `DISEASE_MIN_CONFIDENCE` optionally overrides the default threshold
of `0.70`.

The checkpoint contains tensors and primitive metadata, so supported PyTorch
versions load it with `weights_only=True`. Older PyTorch releases without that
option use `weights_only=False`; point the service only at a trusted local
checkpoint.

## API

Health check:

```powershell
Invoke-RestMethod http://127.0.0.1:8001/health
```

Upload an image (replace the path with a local image):

```powershell
curl.exe -X POST http://127.0.0.1:8001/predict -F "file=@C:\path\to\leaf.jpg;type=image/jpeg"
```

The upload field is named `file` and is limited to 5 MB. The prediction
response includes original checkpoint class names, display labels, crop
metadata, softmax confidence scores, the top three classes, and a disclaimer.
When the top score is below the configured threshold, `model_status` is
`uncertain` and the top-level predicted class, disease name, and crop are null.
Softmax scores are not calibrated probabilities, and outputs are predictions
among only the model's 18 trained classes—not confirmed diagnoses.
