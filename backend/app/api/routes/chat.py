from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.models.schemas import ChatRequest, ChatResponse
from app.services.rag_service import RAGService
from app.config import get_settings, Settings

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    user=Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Send a message and get a RAG-powered response."""
    rag_service = RAGService(settings)

    response = await rag_service.process_query(
        user_id=user.id,
        message=request.message,
        conversation_id=request.conversation_id,
    )

    return response
