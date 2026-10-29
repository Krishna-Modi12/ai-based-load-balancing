import pytest

from app.database import Base, engine


@pytest.fixture(autouse=True)
def isolated_schema():
    """Unit/integration tests deliberately use local SQLite, not Compose PostgreSQL."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)
