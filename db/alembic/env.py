from alembic import context
from sqlalchemy import engine_from_config, pool
import sys
import os
from pathlib import Path

repository_root = Path(__file__).parents[2]
backend_directory = repository_root / "backend"
sys.path.append(str(backend_directory if backend_directory.exists() else repository_root))
from app.database import Base
from app import models  # noqa: F401

config = context.config
if os.getenv("DATABASE_URL"):
    config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
target_metadata = Base.metadata

def run_migrations_offline():
    context.configure(url=config.get_main_option("sqlalchemy.url"), target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction(): context.run_migrations()

def run_migrations_online():
    connectable = engine_from_config(config.get_section(config.config_ini_section), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction(): context.run_migrations()

run_migrations_offline() if context.is_offline_mode() else run_migrations_online()
