from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
VENV_PYTHON = (
    PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
    if os.name == "nt"
    else PROJECT_ROOT / ".venv" / "bin" / "python"
)


def main() -> None:
    npm_command = "npm.cmd" if os.name == "nt" else "npm"
    subprocess.run([npm_command, "run", "build"], cwd=FRONTEND_DIR, check=True)

    env = os.environ.copy()
    backend_path = str(PROJECT_ROOT / "backend")
    existing_path = env.get("PYTHONPATH")
    env["PYTHONPATH"] = (
        backend_path
        if not existing_path
        else os.pathsep.join([backend_path, existing_path])
    )
    env["PM_AI_MODE"] = "stub"

    python_command = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

    subprocess.run(
        [
            python_command,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "3000",
        ],
        cwd=PROJECT_ROOT,
        env=env,
        check=True,
    )


if __name__ == "__main__":
    main()
