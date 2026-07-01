import os
from pydantic_settings import BaseSettings, SettingsConfigDict

# Locate the .env file relative to the config.py location (backend/app/config.py -> backend/.env)
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
env_file_path = os.path.join(backend_dir, ".env")

class Settings(BaseSettings):
    # PostgreSQL Async URL
    DATABASE_URL: str
    
    # Neo4j Bolt URL & Credentials
    NEO4J_URI: str
    NEO4J_USER: str
    NEO4J_PASSWORD: str

    # LLM configurations
    LLM_PROVIDER: str = "ollama"
    OLLAMA_MODEL: str = "deepseek-coder:6.7b"
    GEMINI_API_KEY: str | None = None

    # Tell pydantic to load from the specific absolute path
    model_config = SettingsConfigDict(
        env_file=env_file_path,
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Instantiate settings to be imported across the app
settings = Settings()

