"""phase 7 experiment persistence

Revision ID: 20261029_phase7
Revises: 20261029_initial
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261029_phase7"
down_revision = "20261029_initial"
branch_labels = None
depends_on = None


def upgrade():
    inspector = inspect(op.get_bind())

    def add_if_missing(table: str, column: sa.Column) -> None:
        if column.name not in {item["name"] for item in inspector.get_columns(table)}:
            op.add_column(table, column)

    add_if_missing("routing_decisions", sa.Column("ai_inference_latency_ms", sa.Float(), nullable=True))
    add_if_missing("experiment_runs", sa.Column("repetition", sa.Integer(), server_default="1", nullable=False))
    add_if_missing("experiment_runs", sa.Column("scenario", sa.String(length=50), server_default="none", nullable=False))
    add_if_missing("experiment_runs", sa.Column("raw_results_json", sa.JSON(), nullable=True))
    for name, column in (
        ("timeout_count", sa.Integer(),),
        ("mean_latency_ms", sa.Float()),
        ("error_rate", sa.Float(),),
        ("distribution_json", sa.JSON()),
        ("error_breakdown_json", sa.JSON()),
        ("ai_prediction_count", sa.Integer()),
        ("ai_prediction_p50_ms", sa.Float()),
        ("ai_prediction_p95_ms", sa.Float()),
        ("ai_prediction_mae_ms", sa.Float()),
        ("ai_prediction_rmse_ms", sa.Float()),
        ("ai_inference_p50_ms", sa.Float()),
        ("mean_cpu_percent", sa.Float()),
        ("mean_memory_percent", sa.Float()),
    ):
        add_if_missing("experiment_metrics", sa.Column(name, column, nullable=True))
    if "timeout_count" in {item["name"] for item in inspector.get_columns("experiment_metrics")}:
        op.execute("UPDATE experiment_metrics SET timeout_count = 0 WHERE timeout_count IS NULL")
    if "error_rate" in {item["name"] for item in inspector.get_columns("experiment_metrics")}:
        op.execute("UPDATE experiment_metrics SET error_rate = 0 WHERE error_rate IS NULL")
    if "ai_prediction_count" in {item["name"] for item in inspector.get_columns("experiment_metrics")}:
        op.execute("UPDATE experiment_metrics SET ai_prediction_count = 0 WHERE ai_prediction_count IS NULL")


def downgrade():
    for name in (
        "mean_memory_percent", "mean_cpu_percent", "ai_inference_p50_ms",
        "ai_prediction_rmse_ms", "ai_prediction_mae_ms", "ai_prediction_p95_ms",
        "ai_prediction_p50_ms", "ai_prediction_count", "error_breakdown_json",
        "distribution_json", "error_rate", "mean_latency_ms", "timeout_count",
    ):
        op.drop_column("experiment_metrics", name)
    op.drop_column("experiment_runs", "raw_results_json")
    op.drop_column("experiment_runs", "scenario")
    op.drop_column("experiment_runs", "repetition")
    op.drop_column("routing_decisions", "ai_inference_latency_ms")
