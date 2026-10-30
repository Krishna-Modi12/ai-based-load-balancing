"""persist active routing policy

Revision ID: 20261030_routing_policy
Revises: 20261029_phase7_experiments
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "20261030_routing_policy"
down_revision = "20261029_phase7"
branch_labels = None
depends_on = None


def upgrade():
    if "routing_policy" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "routing_policy",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("policy", sa.String(length=30), nullable=False, server_default="round_robin"),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        )
    op.execute("INSERT INTO routing_policy (id, policy) VALUES (1, 'round_robin') ON CONFLICT (id) DO NOTHING")


def downgrade():
    op.drop_table("routing_policy")
