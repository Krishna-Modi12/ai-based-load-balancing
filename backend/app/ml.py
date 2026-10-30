from __future__ import annotations

import random
import time
from datetime import datetime, timezone
from pathlib import Path
from pickle import UnpicklingError
from zipfile import BadZipFile

import joblib
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, r2_score, root_mean_squared_error
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import Settings
from .models import ModelVersion, RoutingDecision

FEATURE_SCHEMA_VERSION = "v1"
FEATURE_NAMES = [
    "cpu_percent", "memory_percent", "active_requests", "latency_ewma_ms",
    "network_rtt_ms", "error_rate", "capacity_weight", "request_class",
]


class StoredPredictor:
    def __init__(self, model, version_id: str):
        self.model = model
        self.version_id = version_id

    def predict(self, features: list[float]) -> float:
        return float(self.model.predict([features])[0])


def _extract_or_generate_dataset(db: Session) -> tuple[list[list[float]], list[float]]:
    """Fetch recorded calibration decisions or synthesize realistic samples if database is fresh."""
    rows = db.scalars(select(RoutingDecision).where(
        RoutingDecision.success.is_(True),
        RoutingDecision.actual_latency_ms.is_not(None),
        RoutingDecision.features_json.is_not(None),
    ).order_by(RoutingDecision.decided_at)).all()

    if len(rows) >= 20:
        features = [[float(row.features_json[key]) for key in FEATURE_NAMES] for row in rows]
        labels = [float(row.actual_latency_ms) for row in rows]
        return features, labels

    # Synthesize 120 calibration samples reflecting heterogeneous worker topology
    features: list[list[float]] = []
    labels: list[float] = []
    rng = random.Random(42)

    profiles = [
        {"base": 15.0, "cap": 2.0, "cpu": (15.0, 45.0), "rtt": (1.0, 3.0)},  # Fast worker
        {"base": 60.0, "cap": 1.0, "cpu": (40.0, 85.0), "rtt": (3.0, 8.0)},  # Slow worker
        {"base": 30.0, "cap": 1.0, "cpu": (25.0, 60.0), "rtt": (2.0, 5.0)},  # Medium worker
    ]

    for i in range(120):
        prof = rng.choice(profiles)
        cpu = rng.uniform(*prof["cpu"])
        mem = rng.uniform(20.0, 70.0)
        inflight = rng.randint(0, 6)
        rtt = rng.uniform(*prof["rtt"])
        req_cls = rng.choice([1.0, 2.0, 3.0])  # light, normal, heavy
        ewma = prof["base"] + (cpu * 0.25) + (inflight * 3.5)
        err = 0.0 if rng.random() > 0.05 else 0.02
        cap = prof["cap"]

        # Latency formula with non-linear CPU queueing factor
        true_lat = prof["base"] + (cpu * 0.3) + (inflight * 4.0) + (req_cls * 5.0) + rng.gauss(0, 2.0)
        true_lat = max(5.0, true_lat)

        row = [cpu, mem, float(inflight), ewma, rtt, err, cap, req_cls]
        features.append(row)
        labels.append(round(true_lat, 2))

    return features, labels


def train_model(db: Session, settings: Settings) -> ModelVersion:
    features, labels = _extract_or_generate_dataset(db)
    split = max(1, int(len(features) * 0.8))
    model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=1)
    model.fit(features[:split], labels[:split])
    predicted = model.predict(features[split:])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    version = f"rf-{stamp}"
    settings.artifact_dir.mkdir(parents=True, exist_ok=True)
    artifact = settings.artifact_dir / f"{version}.joblib"
    joblib.dump({"model": model, "feature_names": FEATURE_NAMES, "schema": FEATURE_SCHEMA_VERSION}, artifact)
    db.query(ModelVersion).update({ModelVersion.is_active: False})
    saved = ModelVersion(
        version=version, algorithm_name="RandomForestRegressor", artifact_uri=str(artifact),
        training_sample_count=len(features), feature_schema_version=FEATURE_SCHEMA_VERSION,
        validation_mae_ms=float(mean_absolute_error(labels[split:], predicted)),
        validation_rmse_ms=float(root_mean_squared_error(labels[split:], predicted)), is_active=True,
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


def run_model_tournament(db: Session, settings: Settings) -> dict:
    """Benchmark Random Forest vs HistGradientBoosting vs Ridge Regression on calibration data."""
    features, labels = _extract_or_generate_dataset(db)
    split = max(1, int(len(features) * 0.8))
    X_train, y_train = features[:split], labels[:split]
    X_val, y_val = features[split:], labels[split:]

    settings.artifact_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    candidates_def = [
        {
            "slug": "rf",
            "name": "Random Forest Regressor",
            "algo": "RandomForestRegressor",
            "model": RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=1),
            "desc": "Non-linear bagging ensemble of 100 decision trees. Robust against telemetry variance with zero hyperparameter assumptions.",
        },
        {
            "slug": "hgb",
            "name": "Histogram Gradient Boosting",
            "algo": "HistGradientBoostingRegressor",
            "model": HistGradientBoostingRegressor(max_iter=100, random_state=42),
            "desc": "LightGBM-inspired histogram gradient booster with native integer binning. Ultra-fast convergence and superior memory efficiency.",
        },
        {
            "slug": "ridge",
            "name": "Ridge Regression (L2)",
            "algo": "Ridge",
            "model": Ridge(alpha=1.0),
            "desc": "L2-regularized linear baseline model. Features deterministic microsecond inference latency and explicit linear weights.",
        },
    ]

    active_model = db.scalar(select(ModelVersion).where(ModelVersion.is_active.is_(True)))
    active_algo = active_model.algorithm_name if active_model else "RandomForestRegressor"

    evaluated_candidates = []

    for item in candidates_def:
        algo_name = item["algo"]
        model = item["model"]

        # 1. Train and measure time
        t_start = time.perf_counter()
        model.fit(X_train, y_train)
        train_time_ms = round((time.perf_counter() - t_start) * 1000, 2)

        # 2. Predict on validation set and evaluate metrics
        val_preds = model.predict(X_val)
        mae = round(float(mean_absolute_error(y_val, val_preds)), 2)
        rmse = round(float(root_mean_squared_error(y_val, val_preds)), 2)
        r2 = round(float(r2_score(y_val, val_preds)), 3)

        # 3. Benchmark 100 single-item inference calls
        sample_feature = [X_val[0]]
        inf_latencies = []
        for _ in range(100):
            t_inf = time.perf_counter()
            model.predict(sample_feature)
            inf_latencies.append((time.perf_counter() - t_inf) * 1000)
        inf_latencies.sort()
        inf_p95 = round(inf_latencies[int(len(inf_latencies) * 0.95)], 3)

        # 4. Save artifact
        version_str = f"{item['slug']}-{stamp}"
        artifact_path = settings.artifact_dir / f"{version_str}.joblib"
        joblib.dump({"model": model, "feature_names": FEATURE_NAMES, "schema": FEATURE_SCHEMA_VERSION}, artifact_path)

        # 5. Persist or update ModelVersion record
        mv = ModelVersion(
            version=version_str,
            algorithm_name=algo_name,
            artifact_uri=str(artifact_path),
            training_sample_count=len(features),
            feature_schema_version=FEATURE_SCHEMA_VERSION,
            validation_mae_ms=mae,
            validation_rmse_ms=rmse,
            is_active=(algo_name == active_algo),
        )
        db.add(mv)

        evaluated_candidates.append({
            "model_type": item["name"],
            "algorithm_name": algo_name,
            "version": version_str,
            "validation_mae_ms": mae,
            "validation_rmse_ms": rmse,
            "r2_score": max(0.0, r2),
            "train_time_ms": train_time_ms,
            "inference_p95_ms": inf_p95,
            "training_samples": len(features),
            "is_active": (algo_name == active_algo),
            "description": item["desc"],
        })

    db.commit()

    # Sort by lowest validation MAE (rank 1 = champion)
    evaluated_candidates.sort(key=lambda c: c["validation_mae_ms"])
    for idx, c in enumerate(evaluated_candidates, start=1):
        c["rank"] = idx

    return {
        "evaluated_samples": len(features),
        "best_algorithm": evaluated_candidates[0]["algorithm_name"],
        "models": evaluated_candidates,
        "timestamp": datetime.now(timezone.utc),
    }


def activate_algorithm(db: Session, algorithm_name: str) -> ModelVersion | None:
    """Hot-swap the active model to the latest artifact of the selected algorithm."""
    target = db.scalar(
        select(ModelVersion)
        .where(ModelVersion.algorithm_name == algorithm_name)
        .order_by(ModelVersion.trained_at.desc())
    )
    if not target:
        return None
    db.query(ModelVersion).update({ModelVersion.is_active: False})
    target.is_active = True
    db.commit()
    db.refresh(target)
    return target


def _load_predictor(version: ModelVersion) -> StoredPredictor | None:
    if version is None or version.feature_schema_version != FEATURE_SCHEMA_VERSION:
        return None
    try:
        payload = joblib.load(Path(version.artifact_uri))
        if payload.get("feature_names") != FEATURE_NAMES or payload.get("schema") != FEATURE_SCHEMA_VERSION:
            return None
        return StoredPredictor(payload["model"], version.id)
    except (OSError, ValueError, KeyError, TypeError, AttributeError, ImportError, EOFError, UnpicklingError, BadZipFile, RuntimeError):
        return None


def load_active_predictor(db: Session) -> StoredPredictor | None:
    return _load_predictor(db.scalar(select(ModelVersion).where(ModelVersion.is_active.is_(True))))


def load_model_version(db: Session, version: str) -> StoredPredictor | None:
    """Validate a specific persisted artifact before activation."""
    return _load_predictor(db.scalar(select(ModelVersion).where(ModelVersion.version == version)))


def get_feature_importances(db: Session) -> dict[str, float] | None:
    """Extract normalized feature importance weights from the active Random Forest model."""
    version = db.scalar(select(ModelVersion).where(ModelVersion.is_active.is_(True)))
    if not version or not version.artifact_uri:
        return None
    try:
        payload = joblib.load(Path(version.artifact_uri))
        model = payload.get("model")
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            names = payload.get("feature_names", FEATURE_NAMES)
            total = sum(importances) or 1.0
            return {
                name: round(float(imp / total) * 100, 2)
                for name, imp in zip(names, importances)
            }
    except Exception:
        return None
    return None
