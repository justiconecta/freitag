import re

from app.config import Settings
from app.models.database import get_supabase_client
from app.models.schemas import ChatResponse, SourceInfo
from app.services.embedding_service import EmbeddingService
from app.services.vector_service import VectorService
from app.services.llm_service import LLMService

CONVERSATIONAL_PATTERNS = [
    re.compile(r"^(oi|olá|ola|hey|eai|e ai|bom dia|boa tarde|boa noite|hello|hi)\b", re.IGNORECASE),
    re.compile(r"^(tchau|até mais|ate mais|adeus|bye|falou|valeu)\b", re.IGNORECASE),
    re.compile(r"^(obrigad[oa]|brigad[oa]|valeu|thanks|agradeço)\b", re.IGNORECASE),
    re.compile(r"^(tudo bem|como vai|beleza|tranquilo|show|massa)\b", re.IGNORECASE),
    re.compile(r"^(quem é você|o que você faz|como funciona|me ajuda|help)\b", re.IGNORECASE),
]

HISTORY_LIMIT = 10


def classify_intent(message: str) -> str:
    """Classify message as 'conversational' or 'technical'."""
    trimmed = message.strip()
    word_count = len(trimmed.split())

    for pattern in CONVERSATIONAL_PATTERNS:
        if pattern.search(trimmed):
            return "conversational" if word_count <= 8 else "technical"
    return "technical"


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

        # 2. Classify intent
        intent = classify_intent(message)

        # 3. Load conversation history (BEFORE saving current message to avoid duplication)
        history = await self._load_conversation_history(conversation_id)

        # 4. Save user message
        await self._save_message(conversation_id, "user", message)

        sources: list[SourceInfo] = []

        if intent == "conversational":
            # 5a. Conversational: skip embedding/search, respond directly
            response_text = await self.llm_service.generate_conversational_response(
                message, history
            )
        else:
            # 5b. Technical: full RAG pipeline
            # Expand query for better semantic search
            expanded_query = await self._expand_query(message)
            search_text = expanded_query or message

            query_embedding = await self.embedding_service.get_embedding(search_text)
            chunks = await self.vector_service.search_similar_chunks(
                query_embedding, query_text=message
            )

            if chunks:
                response_text = await self.llm_service.generate_response(
                    message, chunks, history
                )
            else:
                # Fallback: use LLM general knowledge instead of static message
                response_text = await self.llm_service.generate_fallback_response(
                    message, history
                )

            # Build sources
            sources = [
                SourceInfo(
                    document_name=chunk.get("doc_name", ""),
                    section=chunk.get("section_title"),
                    page=chunk.get("page_start"),
                    similarity=round(chunk.get("similarity", 0), 3),
                )
                for chunk in chunks[:5]
            ]

        # 6. Save assistant message
        message_id = await self._save_message(
            conversation_id,
            "assistant",
            response_text,
            sources=[s.model_dump() for s in sources] if sources else None,
        )

        return ChatResponse(
            message=response_text,
            conversation_id=conversation_id,
            message_id=message_id,
            sources=sources,
        )

    async def _expand_query(self, query: str) -> str | None:
        """Expand short/technical queries for better semantic search."""
        word_count = len(query.strip().split())
        if word_count > 10:
            return None

        return await self.llm_service.expand_query(query)

    async def _load_conversation_history(
        self, conversation_id: str
    ) -> list[dict]:
        """Load recent conversation history for context."""
        result = (
            self.supabase.table("messages")
            .select("role, content")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True)
            .limit(HISTORY_LIMIT)
            .execute()
        )

        if not result.data:
            return []

        return [
            {"role": msg["role"], "content": msg["content"]}
            for msg in reversed(result.data)
        ]

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
