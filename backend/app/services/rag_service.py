import uuid

from app.config import Settings
from app.models.database import get_supabase_client
from app.models.schemas import ChatResponse, SourceInfo
from app.services.embedding_service import EmbeddingService
from app.services.vector_service import VectorService
from app.services.llm_service import LLMService


class RAGService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.embedding_service = EmbeddingService(settings)
        self.vector_service = VectorService(settings)
        self.llm_service = LLMService(settings)
        self.supabase = get_supabase_client(settings)

    async def process_query(
        self, user_id: str, message: str, conversation_id: str | None = None
    ) -> ChatResponse:
        """Process a user query through the RAG pipeline."""
        # 1. Get or create conversation
        if not conversation_id:
            conversation_id = await self._create_conversation(user_id, message)

        # 2. Save user message
        await self._save_message(conversation_id, "user", message)

        # 3. Generate embedding for the query
        query_embedding = await self.embedding_service.get_embedding(message)

        # 4. Search for similar chunks
        chunks = await self.vector_service.search_similar_chunks(query_embedding)

        # 5. Generate response with Claude
        if chunks:
            response_text = await self.llm_service.generate_response(message, chunks)
        else:
            response_text = (
                "Não encontrei informações relevantes nas normas técnicas disponíveis "
                "para responder sua pergunta. Tente reformular ou pergunte sobre outro tema "
                "relacionado a normas laboratoriais."
            )

        # 6. Build sources
        sources = [
            SourceInfo(
                document_name=chunk.get("doc_name", ""),
                section=chunk.get("section_title"),
                page=chunk.get("page_start"),
                similarity=round(chunk.get("similarity", 0), 3),
            )
            for chunk in chunks[:5]  # Top 5 sources
        ]

        # 7. Save assistant message
        message_id = await self._save_message(
            conversation_id,
            "assistant",
            response_text,
            sources=[s.model_dump() for s in sources],
        )

        return ChatResponse(
            message=response_text,
            conversation_id=conversation_id,
            message_id=message_id,
            sources=sources,
        )

    async def _create_conversation(self, user_id: str, first_message: str) -> str:
        """Create a new conversation."""
        title = first_message[:80] + ("..." if len(first_message) > 80 else "")

        result = (
            self.supabase.table("conversations")
            .insert({"user_id": user_id, "title": title})
            .execute()
        )

        return result.data[0]["id"]

    async def _save_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        sources: list[dict] | None = None,
    ) -> str:
        """Save a message to the database."""
        message_data = {
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
        }
        if sources:
            message_data["sources"] = sources

        result = (
            self.supabase.table("messages")
            .insert(message_data)
            .execute()
        )

        # Update conversation timestamp
        self.supabase.table("conversations").update(
            {"updated_at": "now()"}
        ).eq("id", conversation_id).execute()

        return result.data[0]["id"]
