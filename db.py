"""MySQL connection helpers for the Python API."""

import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv


PROJECT_DIR = Path(__file__).resolve().parent
LOCAL_ENV_FILE = PROJECT_DIR / ".env.local"
CONFIG_FILE = LOCAL_ENV_FILE if LOCAL_ENV_FILE.exists() else PROJECT_DIR / ".env"
load_dotenv(CONFIG_FILE, override=LOCAL_ENV_FILE.exists())


def get_connection():
    """Open MySQL using the local override, or .env as a fallback."""
    required = ("DB_HOST", "DB_USER", "DB_NAME")
    missing = [name for name in required if not os.getenv(name)]
    if missing:
        raise RuntimeError("Configuração do banco ausente: " + ", ".join(missing))

    return mysql.connector.connect(
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.environ["DB_USER"],
        password=os.getenv("DB_PASSWORD", ""),
        database=os.environ["DB_NAME"],
    )
