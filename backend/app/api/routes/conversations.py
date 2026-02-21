from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_current_user
from app.models.schemas import ConversationList, ConversationDetail
from app.models.database import get_supabase_client
from app.config import get_settings, Settings

router = APIRouter()


@router.get("/conversations", response_model=ConversationList)
async def list_conversations(
    user=Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """List all conversations for the authenticated user."""
    supabase = get_supabase_client(settings)

    result = (
        supabase.table("conversations")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", desc=True)
        .execute()
    )

    return ConversationList(conversations=result.data)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    user=Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Get a conversation with all its messages."""
    supabase = get_supabase_client(settings)

    # Get conversation
    conv_result = (
        supabase.table("conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", user.id)
        .single()
        .execute()
    )

    if not conv_result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    msg_result = (
        supabase.table("messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )

    return ConversationDetail(
        **conv_result.data,
        messages=msg_result.data,
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user=Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Delete a conversation and all its messages."""
    supabase = get_supabase_client(settings)

    result = (
        supabase.table("conversations")
        .delete()
        .eq("id", conversation_id)
        .eq("user_id", user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {"status": "deleted"}


@router.patch("/messages/{message_id}/feedback")
async def update_feedback(
    message_id: str,
    feedback: str,
    user=Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Update feedback (like/dislike) for a message."""
    if feedback not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="Feedback must be 'like' or 'dislike'")

    supabase = get_supabase_client(settings)

    result = (
        supabase.table("messages")
        .update({"feedback": feedback})
        .eq("id", message_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Message not found")

    return {"status": "updated", "feedback": feedback}
