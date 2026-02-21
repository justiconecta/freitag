from app.config import Settings
from app.models.database import get_supabase_client


class VectorService:
    def __init__(self, settings: Settings):
        self.supabase = get_supabase_client(settings)
        self.threshold = settings.rag_similarity_threshold
        self.max_chunks = settings.rag_max_chunks

    async def search_similar_chunks(
        self, query_embedding: list[float]
    ) -> list[dict]:
        """Search for similar document chunks using pgvector."""
        result = self.supabase.rpc(
            "search_chunks",
            {
                "query_embedding": query_embedding,
                "match_threshold": self.threshold,
                "match_count": self.max_chunks,
            },
        ).execute()

        return result.data or []
