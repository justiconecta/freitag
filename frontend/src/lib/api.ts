interface ChatRequest {
  message: string;
  conversation_id?: string;
}

interface ChatResponse {
  message: string;
  conversation_id: string;
  message_id: string;
  sources: Array<{
    document_name: string;
    section: string | null;
    page: number | null;
    similarity: number;
  }>;
}

export async function sendChatMessage(
  request: ChatRequest,
  token: string
): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function getConversations(token: string) {
  const response = await fetch("/api/conversations", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
