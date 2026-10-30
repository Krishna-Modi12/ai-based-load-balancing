from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class BackendCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: HttpUrl
    capacity_weight: float = Field(default=1.0, gt=0)


class BackendPatch(BaseModel):
    enabled: bool | None = None
    capacity_weight: float | None = Field(default=None, gt=0)


class PolicyUpdate(BaseModel):
    policy: str = Field(pattern="^(round_robin|weighted_round_robin|least_connections|ai_latency)$")


class BackendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    base_url: str
    capacity_weight: float
    enabled: bool
    health_status: str
    last_health_at: datetime | None


class BackendDetail(BackendOut):
    telemetry: list[dict[str, Any]] = Field(default_factory=list)


class PolicyOut(BaseModel):
    policy: str

class DecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    request_id: str
    policy: str
    selected_backend_id: str | None
    predicted_latency_ms: float | None
    actual_latency_ms: float | None
    status_code: int | None
    success: bool
    fallback_reason: str | None
    decided_at: datetime


class ModelVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    version: str
    algorithm_name: str
    trained_at: datetime
    training_sample_count: int
    feature_schema_version: str
    validation_mae_ms: float
    validation_rmse_ms: float
    is_active: bool


WORKLOAD_PROFILES = ("uniform", "heterogeneous", "bursty", "mixed")
EXPERIMENT_POLICIES = ("round_robin", "weighted_round_robin", "least_connections", "ai_latency")
FAILURE_SCENARIOS = ("none", "node_failure", "stale_telemetry", "missing_model", "timeout")


class ExperimentConfig(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    policy: Literal["round_robin", "weighted_round_robin", "least_connections", "ai_latency"]
    workload_profile: Literal["uniform", "heterogeneous", "bursty", "mixed"]
    repetition: int = Field(default=1, ge=1, le=100)
    scenario: Literal["none", "node_failure", "stale_telemetry", "missing_model", "timeout"] = "none"
    duration_seconds: float = Field(default=10, gt=0, le=3600)
    warmup_seconds: float = Field(default=2, ge=0, le=600)
    concurrency: int = Field(default=4, ge=1, le=200)
    request_rate: float | None = Field(default=None, gt=0, le=1000)
    seed: int = Field(default=42, ge=0, le=2**31 - 1)
    target_base_url: str = Field(default="http://localhost:8000", min_length=8, max_length=500)
    request_timeout_seconds: float = Field(default=10, gt=0, le=120)
    notes: str | None = Field(default=None, max_length=2000)


class ExperimentMetricOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    metric_scope: str
    backend_id: str | None
    request_count: int
    success_count: int
    error_count: int
    timeout_count: int
    throughput_rps: float
    error_rate: float
    mean_latency_ms: float | None
    latency_p50_ms: float | None
    latency_p95_ms: float | None
    latency_p99_ms: float | None
    distribution_json: dict[str, Any] | None
    error_breakdown_json: dict[str, int] | None
    ai_prediction_count: int
    ai_prediction_p50_ms: float | None
    ai_prediction_p95_ms: float | None
    ai_prediction_mae_ms: float | None
    ai_prediction_rmse_ms: float | None
    ai_inference_p50_ms: float | None
    mean_cpu_percent: float | None
    mean_memory_percent: float | None
    load_balance_cv: float | None
    fairness_jain: float | None


class ExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    policy: str
    workload_profile: str
    repetition: int
    scenario: str
    configuration_json: dict[str, Any]
    status: str
    started_at: datetime | None
    ended_at: datetime | None
    notes: str | None


class ExperimentDetail(ExperimentOut):
    metrics: list[ExperimentMetricOut]


class ExperimentListItem(ExperimentOut):
    metric: ExperimentMetricOut | None = None
