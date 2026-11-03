
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


# Locate the existing trained model
ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "models" / "crop_recommendation_pipeline.joblib"

# Load the saved pipeline and metadata
saved_model = joblib.load(MODEL_PATH)

model = saved_model["pipeline"]
metadata = saved_model["metadata"]

FEATURES = metadata["features"]

app = FastAPI(
    title="AgriOne AI Crop Prediction API",
    version="1.0.0"
)


class CropInput(BaseModel):
    N: float = Field(ge=0, le=140)
    P: float = Field(ge=5, le=145)
    K: float = Field(ge=5, le=205)
    temperature: float = Field(ge=8.825, le=43.675)
    humidity: float = Field(ge=14.258, le=99.982)
    ph: float = Field(ge=3.505, le=9.935)
    rainfall: float = Field(ge=20.211, le=298.56)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": metadata["model_type"],
        "model_loaded": True
    }


@app.post("/predict")
def predict_crop(data: CropInput):
    try:
        input_data = pd.DataFrame(
            [[getattr(data, feature) for feature in FEATURES]],
            columns=FEATURES
        )

        prediction = model.predict(input_data)[0]
        probabilities = model.predict_proba(input_data)[0]

        probability_map = {
            crop: round(float(prob) * 100, 2)
            for crop, prob in zip(model.classes_, probabilities)
        }

        return {
            "success": True,
            "predictedCrop": str(prediction),
            "probability": probability_map[str(prediction)],
            "modelType": metadata["model_type"],
            "modelStatus": "trained_ml_model"
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}"
        )
