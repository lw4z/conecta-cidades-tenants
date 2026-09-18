import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User

# Force test env
settings.SECRET_KEY = "test-secret-key-for-testing"
settings.FIELD_ENCRYPTION_KEY = "_WuoYIhAm6RUNW_BmXU2Osn3qe6TDvuukT6z-hy7mtg="  # valid Fernet key

# Reset cached Fernet singleton so it re-initializes with the test key
import app.core.security as _sec  # noqa: E402
_sec._fernet = None


@pytest.fixture(name="engine")
def engine_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    SQLModel.metadata.drop_all(engine)


@pytest.fixture(name="session")
def session_fixture(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(engine):
    def override_get_db():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    # Don't use context manager — it triggers lifespan which hits the global engine
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


@pytest.fixture(name="admin_user")
def admin_user_fixture(session):
    user = User(
        username="testadmin",
        email="test@admin.com",
        password_hash=hash_password("testpass123"),
        full_name="Test Admin",
        is_active=True,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.fixture(name="auth_client")
def auth_client_fixture(client, admin_user):
    token = create_access_token(admin_user.id)
    client.cookies.set("access_token", token)
    return client
