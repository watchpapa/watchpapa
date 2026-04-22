"""Shared pytest configuration."""

from pathlib import Path

from dotenv import load_dotenv

# Match Backend scripts: load repo-root .env into os.environ before tests run.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
