from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class BackendCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: HttpUrl
    capacity_weight: float = Field(default=1.0, gt=0)


class BackendPatch(BaseModel):
    enabled: bool | None = None
    capacity_weight: float | None = Field(default=None, gt=0)


class PolicyUpdate(BaseModel):
    policy: str = Field(pattern="^(round_robin|least_connections|ai_latency)$")


class BackendOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    base_url: str
    capacity_weight: float
    enabled: bool
    health_status: str
    last_health_at: datetime | None

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

