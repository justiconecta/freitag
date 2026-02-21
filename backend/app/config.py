from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""

    # Anthropic (Claude)
    anthropic_api_key: str = ""

    # Google AI (Embeddings - free tier)
    google_api_key: str = ""

    # App
    cors_origins: str = "http://localhost:3000"
    environment: str = "development"

    # RAG Settings
    rag_similarity_threshold: float = 0.7
    rag_max_chunks: int = 8
    rag_model: str = "claude-sonnet-4-20250514"
    rag_max_tokens: int = 2048
    rag_temperature: float = 0.3
    embedding_model: str = "gemini-embedding-001"
    embedding_dimensions: int = 768
    chunk_size: int = 512
    chunk_overlap: int = 50

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
