# Crop recommendation model development

The training workflow is isolated in this directory. It validates
`datasets/crop/crop_recommendation_clean.csv`, compares classifiers using a
stratified train/test split and stratified cross-validation, then saves a
deployment pipeline only after evaluation succeeds.

## Setup and reproduce

From the repository root, install the ML dependencies and run validation:

```powershell
& "C:\Users\pavani\AppData\Local\Programs\Python\Python311\python.exe" -m pip install -r ml\requirements.txt
& "C:\Users\pavani\AppData\Local\Programs\Python\Python311\python.exe" ml\train_crop_model.py --validate-only
```

After resolving any dataset validation errors, reproduce model evaluation and
training with:

```powershell
& "C:\Users\pavani\AppData\Local\Programs\Python\Python311\python.exe" ml\train_crop_model.py
```

The evaluation report is written to `reports/crop_model_evaluation.json`, the
dataset checks to `reports/crop_dataset_validation.json`, and the selected
preprocessing/model pipeline plus metadata to
`models/crop_recommendation_pipeline.joblib`. The split and CV random seed is
42. The held-out test set is evaluated before the saved pipeline is refitted
on all validated rows.

The model uses features in this exact order: `N, P, K, temperature, humidity,
ph, rainfall`; `label` is the target. Scores are offline benchmark results and
are not a substitute for regional field validation.
