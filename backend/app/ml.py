from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from pickle import UnpicklingError
from zipfile import BadZipFile

import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, root_mean_squared_error
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


def train_model(db: Session, settings: Settings) -> ModelVersion:
    rows = db.scalars(select(RoutingDecision).where(
        RoutingDecision.success.is_(True),
        RoutingDecision.actual_latency_ms.is_not(None),
        RoutingDecision.features_json.is_not(None),
    ).order_by(RoutingDecision.decided_at)).all()
    if len(rows) < 20:
        raise ValueError("At least 20 recorded successful calibration samples are required.")
    features = [[float(row.features_json[key]) for key in FEATURE_NAMES] for row in rows]
    labels = [float(row.actual_latency_ms) for row in rows]
    split = max(1, int(len(rows) * 0.8))
    if len(rows) - split < 1:
        raise ValueError("Not enough independent validation samples.")
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
        training_sample_count=len(rows), feature_schema_version=FEATURE_SCHEMA_VERSION,
        validation_mae_ms=float(mean_absolute_error(labels[split:], predicted)),
        validation_rmse_ms=float(root_mean_squared_error(labels[split:], predicted)), is_active=True,
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved


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
