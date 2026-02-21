from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class SourceInfo(BaseModel):
    document_name: str
    section: str | None = None
    page: int | None = None
    similarity: float


class ChatResponse(BaseModel):
    message: str
    conversation_id: str
    message_id: str
    sources: list[SourceInfo]


class ConversationSummary(BaseModel):
    id: str
    user_id: str
    title: str | None = None
    created_at: str
    updated_at: str


class ConversationList(BaseModel):
    conversations: list[ConversationSummary]


class MessageInfo(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    sources: list[dict] | None = None
    feedback: str | None = None
    created_at: str


class ConversationDetail(BaseModel):
    id: str
    user_id: str
    title: str | None = None
    created_at: str
    updated_at: str
    messages: list[MessageInfo]
