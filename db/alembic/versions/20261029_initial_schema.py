"""initial persistence schema

Revision ID: 20261029_initial
Revises:
Create Date: 2026-10-29
"""
from alembic import op
import sys
from pathlib import Path

repository_root = Path(__file__).parents[3]
application_directory = repository_root / "backend"
sys.path.insert(0, str(application_directory if (application_directory / "app").exists() else repository_root))
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
