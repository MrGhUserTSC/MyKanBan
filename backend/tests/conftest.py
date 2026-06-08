from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def app(tmp_path: Path):
    app = create_app(tmp_path / "pm-test.db")
    app.state.sessions.clear()
    return app


@pytest.fixture
def client(app):
    with TestClient(app) as test_client:
        yield test_client
