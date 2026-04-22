"""Environment checks aligned with Backend TMDB usage."""

import os


def test_tmdb_api_key_secret_in_environment():
    assert "TMDB_API_KEY_SECRET" in os.environ, (
        "TMDB_API_KEY_SECRET must be set (export it or add it to a repo-root .env file)."
    )
    assert os.environ["TMDB_API_KEY_SECRET"].strip(), (
        "TMDB_API_KEY_SECRET is set but empty."
    )
