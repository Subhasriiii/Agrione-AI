#!/usr/bin/env python
"""Validate, evaluate, and train the AgriOne crop recommendation model."""

from __future__ import annotations

import argparse
import json
import math
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.base import clone
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import ExtraTreesClassifier, HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate, train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


ROOT = Path(__file__).resolve().parent
DATASET = ROOT / "datasets" / "crop" / "crop_recommendation_clean.csv"
REPORT_DIR = ROOT / "reports"
MODEL_DIR = ROOT / "models"
VALIDATION_REPORT = REPORT_DIR / "crop_dataset_validation.json"
EVALUATION_REPORT = REPORT_DIR / "crop_model_evaluation.json"
MODEL_PATH = MODEL_DIR / "crop_recommendation_pipeline.joblib"

FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET = "label"
COLUMNS = FEATURES + [TARGET]
RANDOM_STATE = 42
TEST_SIZE = 0.20
CV_FOLDS = 5

# These are broad physical-domain checks, not crop-specific agronomic limits.
VALID_RANGES = {
    "N": (0, math.inf),
    "P": (0, math.inf),
    "K": (0, math.inf),
    "temperature": (-50, 60),
    "humidity": (0, 100),
    "ph": (0, 14),
    "rainfall": (0, math.inf),
}


def json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(item) for item in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(json_safe(data), indent=2, allow_nan=False) + "\n", encoding="utf-8")


def validate_dataset(path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    if not path.is_file():
        raise FileNotFoundError(f"Dataset not found: {path}")

    frame = pd.read_csv(path)
    actual_columns = frame.columns.tolist()
    schema_matches = actual_columns == COLUMNS
    missing_columns = [column for column in COLUMNS if column not in actual_columns]
    unexpected_columns = [column for column in actual_columns if column not in COLUMNS]
    schema_order_matches = schema_matches

    report: dict[str, Any] = {
        "dataset_path": str(path),
        "expected_columns_in_order": COLUMNS,
        "actual_columns_in_order": actual_columns,
        "schema_matches_exactly": schema_matches,
        "missing_columns": missing_columns,
        "unexpected_columns": unexpected_columns,
        "row_count": int(len(frame)),
    }

    if missing_columns:
        report["validation_status"] = "failed"
        report["failure_reason"] = "Required columns are missing."
        return frame, report

    # Do not silently reorder or coerce the schema when the incoming CSV differs.
    numeric = frame[FEATURES].apply(pd.to_numeric, errors="coerce")
    feature_missing = numeric.isna()
    non_numeric = frame[FEATURES].notna() & numeric.isna()
    infinite = pd.DataFrame(
        {
            column: numeric[column].notna()
            & ~np.isfinite(numeric[column].to_numpy(dtype=float))
            for column in FEATURES
        },
        index=frame.index,
    )
    out_of_range: dict[str, int] = {}
    for column, (minimum, maximum) in VALID_RANGES.items():
        out_of_range[column] = int(
            ((numeric[column] < minimum) | (numeric[column] > maximum)).fillna(False).sum()
        )

    labels = frame[TARGET]
    empty_labels = labels.isna() | labels.astype("string").str.strip().eq("")
    exact_duplicates = int(frame.duplicated(keep="first").sum())
    feature_duplicate_mask = numeric.duplicated(keep=False)
    feature_duplicate_groups = int(numeric[feature_duplicate_mask].drop_duplicates().shape[0])
    conflicting_duplicate_groups = 0
    if feature_duplicate_mask.any():
        label_counts = (
            pd.concat([numeric.loc[feature_duplicate_mask], labels.loc[feature_duplicate_mask]], axis=1)
            .groupby(FEATURES, dropna=False)[TARGET]
            .nunique(dropna=False)
        )
        conflicting_duplicate_groups = int((label_counts > 1).sum())

    clean_labels = labels.loc[~empty_labels].astype(str).str.strip()
    class_distribution = Counter(clean_labels.tolist())
    report.update(
        {
            "schema_order_matches": schema_order_matches,
            "missing_values_by_column": {
                column: int(frame[column].isna().sum()) for column in COLUMNS
            },
            "feature_missing_values_after_numeric_parse": {
                column: int(feature_missing[column].sum()) for column in FEATURES
            },
            "non_numeric_feature_values": {
                column: int(non_numeric[column].sum()) for column in FEATURES
            },
            "infinite_feature_values": {
                column: int(infinite[column].sum()) for column in FEATURES
            },
            "out_of_physical_domain_values": out_of_range,
            "empty_target_values": int(empty_labels.sum()),
            "exact_duplicate_rows": exact_duplicates,
            "duplicate_feature_groups": feature_duplicate_groups,
            "duplicate_feature_groups_with_conflicting_labels": conflicting_duplicate_groups,
            "class_count": int(len(class_distribution)),
            "class_distribution": dict(sorted(class_distribution.items())),
            "feature_ranges": {
                column: {
                    "min": float(numeric[column].min()) if numeric[column].notna().any() else None,
                    "max": float(numeric[column].max()) if numeric[column].notna().any() else None,
                }
                for column in FEATURES
            },
        }
    )

    invalid_numeric = bool(non_numeric.any().any() or infinite.any().any())
    invalid_domain = any(count > 0 for count in out_of_range.values())
    no_usable_feature = any(numeric[column].notna().sum() == 0 for column in FEATURES)
    validation_errors = []
    if not schema_order_matches:
        validation_errors.append("CSV columns do not match the required names and order.")
    if empty_labels.any():
        validation_errors.append("Target label contains missing or blank values.")
    if invalid_numeric:
        validation_errors.append("Feature values contain non-numeric or infinite values.")
    if invalid_domain:
        validation_errors.append("Feature values fall outside broad physical-domain limits.")
    if no_usable_feature:
        validation_errors.append("At least one feature has no usable numeric values.")
    if conflicting_duplicate_groups:
        validation_errors.append("Identical feature vectors have conflicting target labels.")

    report["validation_status"] = "failed" if validation_errors else "passed"
    report["validation_errors"] = validation_errors
    return frame, report


def make_candidates() -> dict[str, Pipeline]:
    def pipeline(classifier: Any, scale: bool = False) -> Pipeline:
        steps: list[tuple[str, Any]] = [("imputer", SimpleImputer(strategy="median"))]
        if scale:
            steps.append(("scaler", StandardScaler()))
        steps.append(("classifier", classifier))
        return Pipeline(steps)

    return {
        "DummyClassifier (prior)": pipeline(
            DummyClassifier(strategy="prior", random_state=RANDOM_STATE)
        ),
        "Random Forest": pipeline(
            RandomForestClassifier(
                n_estimators=400,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            )
        ),
        "Extra Trees": pipeline(
            ExtraTreesClassifier(
                n_estimators=400,
                random_state=RANDOM_STATE,
                n_jobs=-1,
            )
        ),
        "HistGradientBoosting": pipeline(
            HistGradientBoostingClassifier(
                max_iter=200,
                random_state=RANDOM_STATE,
            )
        ),
        "RBF SVM": pipeline(
            SVC(C=10, kernel="rbf", probability=True, random_state=RANDOM_STATE),
            scale=True,
        ),
        "K-Nearest Neighbors": pipeline(
            KNeighborsClassifier(n_neighbors=7, weights="distance"),
            scale=True,
        ),
        "Gaussian Naive Bayes": pipeline(GaussianNB(), scale=True),
    }


def metric_summary(y_true: pd.Series, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
    }


def evaluate(frame: pd.DataFrame, validation_report: dict[str, Any]) -> dict[str, Any]:
    if validation_report["validation_status"] != "passed":
        raise ValueError(
            "Dataset validation failed; resolve validation errors before training: "
            + "; ".join(validation_report.get("validation_errors", []))
        )

    features = frame[FEATURES].apply(pd.to_numeric, errors="coerce")
    target = frame[TARGET].astype(str).str.strip()
    labels = sorted(target.unique().tolist())
    x_train, x_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=target,
    )
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    scoring = {
        "accuracy": "accuracy",
        "precision_macro": "precision_macro",
        "recall_macro": "recall_macro",
        "f1_macro": "f1_macro",
    }

    candidates = make_candidates()
    candidate_results: list[dict[str, Any]] = []
    fitted_cv: dict[str, dict[str, Any]] = {}
    for name, estimator in candidates.items():
        cv_result = cross_validate(
            estimator,
            x_train,
            y_train,
            cv=cv,
            scoring=scoring,
            return_train_score=False,
            n_jobs=1,
            error_score="raise",
        )
        metrics = {
            key: {
                "mean": float(np.mean(cv_result[f"test_{key}"])),
                "std": float(np.std(cv_result[f"test_{key}"], ddof=1)),
                "fold_scores": [float(value) for value in cv_result[f"test_{key}"]],
            }
            for key in scoring
        }
        candidate_results.append(
            {
                "model": name,
                "cv_metrics": metrics,
                "mean_fit_time_seconds": float(np.mean(cv_result["fit_time"])),
            }
        )
        fitted_cv[name] = {"estimator": estimator, "cv_metrics": metrics}

    # Select exclusively on mean stratified-CV macro F1; the holdout remains unseen.
    candidate_results.sort(
        key=lambda result: (
            result["cv_metrics"]["f1_macro"]["mean"],
            result["cv_metrics"]["accuracy"]["mean"],
        ),
        reverse=True,
    )
    selected_name = candidate_results[0]["model"]
    selected = clone(fitted_cv[selected_name]["estimator"])
    selected.fit(x_train, y_train)
    train_predictions = selected.predict(x_train)
    test_predictions = selected.predict(x_test)
    train_metrics = metric_summary(y_train, train_predictions)
    test_metrics = metric_summary(y_test, test_predictions)
    overfit_gaps = {
        metric: train_metrics[metric] - test_metrics[metric] for metric in train_metrics
    }

    report: dict[str, Any] = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "dataset": str(DATASET),
        "dataset_rows": int(len(frame)),
        "features_in_model_order": FEATURES,
        "target": TARGET,
        "class_labels": labels,
        "split": {
            "method": "train_test_split with stratify=label",
            "test_size": TEST_SIZE,
            "random_state": RANDOM_STATE,
            "training_rows": int(len(x_train)),
            "test_rows": int(len(x_test)),
        },
        "cross_validation": {
            "method": "StratifiedKFold",
            "folds": CV_FOLDS,
            "shuffle": True,
            "random_state": RANDOM_STATE,
            "selection_metric": "mean macro F1",
        },
        "metrics_definition": "Precision, recall, and F1 are macro-averaged across crop labels.",
        "candidate_results_ranked_by_cv_macro_f1": candidate_results,
        "selected_model": selected_name,
        "selected_cv_metrics": fitted_cv[selected_name]["cv_metrics"],
        "selected_model_training_metrics": train_metrics,
        "held_out_test_metrics": test_metrics,
        "train_minus_test_metric_gap": overfit_gaps,
        "held_out_classification_report": classification_report(
            y_test, test_predictions, labels=labels, output_dict=True, zero_division=0
        ),
        "held_out_confusion_matrix": {
            "labels_in_row_and_column_order": labels,
            "matrix": confusion_matrix(y_test, test_predictions, labels=labels).tolist(),
        },
        "limitations": [
            "This is a small, single-source dataset; a random split cannot establish performance in other regions, seasons, years, or measurement systems.",
            "The records may be synthetic, curated, or otherwise unrepresentative; provenance and field validation are not established by this evaluation.",
            "The target is the dataset label, not observed crop yield, profitability, or causal suitability.",
            "The model only sees N, P, K, temperature, humidity, pH, and rainfall; it does not account for location, season, soil type, irrigation, prices, or farmer constraints.",
            "A high random-split score can be optimistic if near-duplicates or source-specific patterns occur across the split; duplicate checks are reported separately.",
            "Predicted class probabilities, when available, are not automatically calibrated and must not be presented as agronomic confidence without calibration and external validation.",
        ],
    }

    # The artifact is saved only after validation, CV comparison, and holdout evaluation.
    # Refit on all validated rows for deployment after recording the untouched holdout result.
    deployment_pipeline = clone(fitted_cv[selected_name]["estimator"])
    deployment_pipeline.fit(features, target)
    metadata = {
        "model_type": selected_name,
        "features": FEATURES,
        "target": TARGET,
        "classes": labels,
        "random_state": RANDOM_STATE,
        "cross_validation_folds": CV_FOLDS,
        "test_metrics": test_metrics,
        "scikit_learn_version": sklearn.__version__,
        "training_rows_for_saved_pipeline": int(len(frame)),
        "evaluation_report": str(EVALUATION_REPORT),
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"pipeline": deployment_pipeline, "metadata": metadata}, MODEL_PATH)
    report["saved_model_path"] = str(MODEL_PATH)
    report["saved_pipeline_training_rows"] = int(len(frame))
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Validate the CSV and write a validation report without model training.",
    )
    args = parser.parse_args()

    frame, validation_report = validate_dataset(DATASET)
    write_json(VALIDATION_REPORT, validation_report)
    print(json.dumps(validation_report, indent=2, allow_nan=False))
    print(f"\nValidation report: {VALIDATION_REPORT}")

    if validation_report["validation_status"] != "passed":
        raise SystemExit(1)
    if args.validate_only:
        print("\nValidation-only run; no model was trained or saved.")
        return

    evaluation_report = evaluate(frame, validation_report)
    write_json(EVALUATION_REPORT, evaluation_report)
    print("\nEvaluation summary:")
    print(json.dumps(
        {
            "selected_model": evaluation_report["selected_model"],
            "candidate_results_ranked_by_cv_macro_f1": [
                {
                    "model": result["model"],
                    "cv_accuracy_mean": result["cv_metrics"]["accuracy"]["mean"],
                    "cv_precision_macro_mean": result["cv_metrics"]["precision_macro"]["mean"],
                    "cv_recall_macro_mean": result["cv_metrics"]["recall_macro"]["mean"],
                    "cv_f1_macro_mean": result["cv_metrics"]["f1_macro"]["mean"],
                    "cv_f1_macro_std": result["cv_metrics"]["f1_macro"]["std"],
                }
                for result in evaluation_report["candidate_results_ranked_by_cv_macro_f1"]
            ],
            "held_out_test_metrics": evaluation_report["held_out_test_metrics"],
            "train_minus_test_metric_gap": evaluation_report["train_minus_test_metric_gap"],
            "confusion_matrix": evaluation_report["held_out_confusion_matrix"],
            "model_path": evaluation_report["saved_model_path"],
            "evaluation_report": str(EVALUATION_REPORT),
        },
        indent=2,
        allow_nan=False,
    ))


if __name__ == "__main__":
    main()
