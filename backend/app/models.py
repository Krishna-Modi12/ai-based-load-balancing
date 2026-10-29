import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BackendNode(Base):
    __tablename__ = "backend_nodes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    base_url: Mapped[str] = mapped_column(String(500), unique=True)
    capacity_weight: Mapped[float] = mapped_column(Float, default=1.0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    health_status: Mapped[str] = mapped_column(String(20), default="unknown")
    last_health_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class TelemetrySample(Base):
    __tablename__ = "telemetry_samples"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    backend_id: Mapped[str] = mapped_column(ForeignKey("backend_nodes.id"), index=True)
    sampled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    cpu_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    active_requests: Mapped[int] = mapped_column(Integer, default=0)
    latency_ewma_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    network_rtt_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_rate: Mapped[float] = mapped_column(Float, default=0.0)
    success_rate: Mapped[float] = mapped_column(Float, default=1.0)
    telemetry_source: Mapped[str] = mapped_column(String(30), default="worker_metrics")


class ModelVersion(Base):
    __tablename__ = "model_versions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    version: Mapped[str] = mapped_column(String(100), unique=True)
    algorithm_name: Mapped[str] = mapped_column(String(100))
    artifact_uri: Mapped[str] = mapped_column(String(500))
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    training_sample_count: Mapped[int] = mapped_column(Integer)
    feature_schema_version: Mapped[str] = mapped_column(String(50))
    validation_mae_ms: Mapped[float] = mapped_column(Float)
    validation_rmse_ms: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)


class RoutingDecision(Base):
    __tablename__ = "routing_decisions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    policy: Mapped[str] = mapped_column(String(30), index=True)
    selected_backend_id: Mapped[str | None] = mapped_column(ForeignKey("backend_nodes.id"), nullable=True)
    model_version_id: Mapped[str | None] = mapped_column(ForeignKey("model_versions.id"), nullable=True)
    predicted_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    request_class: Mapped[str] = mapped_column(String(20), default="normal")
    fallback_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    failure_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    features_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ExperimentRun(Base):
    __tablename__ = "experiment_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(200))
    policy: Mapped[str] = mapped_column(String(30))
    workload_profile: Mapped[str] = mapped_column(String(100))
    configuration_json: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="queued")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class ExperimentMetric(Base):
    __tablename__ = "experiment_metrics"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    experiment_id: Mapped[str] = mapped_column(ForeignKey("experiment_runs.id"), index=True)
    backend_id: Mapped[str | None] = mapped_column(ForeignKey("backend_nodes.id"), nullable=True)
    metric_scope: Mapped[str] = mapped_column(String(20), default="overall")
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    throughput_rps: Mapped[float] = mapped_column(Float, default=0)
    latency_p50_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    latency_p95_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    latency_p99_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    load_balance_cv: Mapped[float | None] = mapped_column(Float, nullable=True)
    fairness_jain: Mapped[float | None] = mapped_column(Float, nullable=True)
