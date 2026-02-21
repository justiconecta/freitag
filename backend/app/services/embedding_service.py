from google import genai
from google.genai import types

from app.config import Settings


class EmbeddingService:
    def __init__(self, settings: Settings):
        self.client = genai.Client(api_key=settings.google_api_key)
        self.model = settings.embedding_model
        self.dimensions = settings.embedding_dimensions

    async def get_embedding(self, text: str) -> list[float]:
        """Generate embedding for a single text (query)."""
        result = self.client.models.embed_content(
            model=self.model,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=self.dimensions),
        )
        return list(result.embeddings[0].values)

    async def get_embeddings(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts (documents)."""
        embeddings = []
        for text in texts:
            result = self.client.models.embed_content(
                model=self.model,
                contents=text,
                config=types.EmbedContentConfig(output_dimensionality=self.dimensions),
            )
            embeddings.append(list(result.embeddings[0].values))
        return embeddings
