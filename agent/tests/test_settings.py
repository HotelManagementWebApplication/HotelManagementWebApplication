import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from pydantic import ValidationError

from app.settings import Settings


class SettingsTest(unittest.TestCase):
    def test_env_example_uses_the_names_consumed_by_settings(self) -> None:
        template = (Path(__file__).resolve().parents[1] / ".env.example").read_text(encoding="utf-8")
        self.assertIn("GEMINI_GENERATION_MODEL=", template)
        self.assertIn("GEMINI_EMBEDDING_MODEL=", template)
        self.assertIn("GEMINI_EMBEDDING_DIMENSIONS=", template)
        self.assertIn("AGENT_CORS_ORIGINS=", template)

    def test_dotenv_values_precede_process_env_without_secret_leaks(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            env_file = Path(temp_dir) / ".env"
            env_file.write_text(
                "AI_PROVIDER=gemini\n"
                "GEMINI_API_KEY=dotenv-secret\n"
                "GEMINI_GENERATION_MODEL=dotenv-generation\n"
                "GEMINI_EMBEDDING_MODEL=dotenv-embedding\n"
                "GEMINI_EMBEDDING_DIMENSIONS=512\n",
                encoding="utf-8",
            )
            with patch.dict(
                os.environ,
                {
                    "GEMINI_API_KEY": "stale-process-secret",
                    "GEMINI_GENERATION_MODEL": "process-generation",
                    "GEMINI_EMBEDDING_MODEL": "process-embedding",
                    "GEMINI_EMBEDDING_DIMENSIONS": "256",
                },
                clear=False,
            ):
                settings = Settings(_env_file=env_file)
                explicit = Settings(
                    _env_file=env_file,
                    ai_provider="gemini",
                    gemini_api_key="init-secret",
                    gemini_generation_model="init-generation",
                )

            self.assertEqual("dotenv-secret", settings.gemini_api_key.get_secret_value())
            self.assertEqual("dotenv-generation", settings.gemini_generation_model)
            self.assertEqual("dotenv-embedding", settings.gemini_embedding_model)
            self.assertEqual(512, settings.gemini_embedding_dimensions)
            self.assertEqual("init-secret", explicit.gemini_api_key.get_secret_value())
            self.assertEqual("init-generation", explicit.gemini_generation_model)
            self.assertNotIn("dotenv-secret", repr(settings))
            self.assertNotIn("stale-process-secret", repr(settings))

            with self.assertRaises(ValidationError) as raised:
                Settings(_env_file=env_file, ai_provider="offline")
            error_text = str(raised.exception)
            self.assertNotIn("dotenv-secret", error_text)
            self.assertNotIn("stale-process-secret", error_text)

    def test_comma_separated_cors_origins_match_env_example(self) -> None:
        with patch.dict(
            os.environ,
            {"AGENT_CORS_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173"},
            clear=False,
        ):
            settings = Settings(_env_file=None)

        self.assertEqual(
            ["http://localhost:5173", "http://127.0.0.1:5173"],
            settings.agent_cors_origins,
        )

    def test_wildcard_cors_origin_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValidationError, "explicit origins"):
            Settings(agent_cors_origins=["*"])

    def test_gemini_requires_api_key(self) -> None:
        with self.assertRaisesRegex(ValidationError, "GEMINI_API_KEY is required"):
            Settings(_env_file=None, ai_provider="gemini", gemini_api_key=None)

    def test_offline_provider_is_not_a_runtime_option(self) -> None:
        with self.assertRaisesRegex(ValidationError, "AI_PROVIDER must be gemini"):
            Settings(_env_file=None, ai_provider="offline", gemini_api_key="test-key")

    def test_gemini_accepts_secret_without_exposing_it(self) -> None:
        settings = Settings(_env_file=None, ai_provider="gemini", gemini_api_key="top-secret")
        self.assertEqual("gemini", settings.ai_provider)
        self.assertNotIn("top-secret", repr(settings))


if __name__ == "__main__":
    unittest.main()
