"""initial persistence schema

Revision ID: 20261029_initial
Revises:
Create Date: 2026-10-29
"""
from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "20261029_initial"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    Base.metadata.create_all(bind=op.get_bind())

def downgrade():
    Base.metadata.drop_all(bind=op.get_bind())
