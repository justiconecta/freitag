import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getEmbedding } from "./embedding";
import { searchSimilarChunks } from "./vector";
import {
  generateResponse,
  generateConversationalResponse,
  HistoryMessage,
} from "./llm";

export interface SourceInfo {
  document_name: string;
  section: string | null;
  page: number | null;
  similarity: number;
}

export interface ChatResult {
  message: string;
  conversation_id: string;
  message_id: string;
  sources: SourceInfo[];
}

type Intent = "conversational" | "technical";

const CONVERSATIONAL_PATTERNS = [
  /^(oi|olá|ola|hey|eai|e ai|bom dia|boa tarde|boa noite|hello|hi)\b/i,
  /^(tchau|até mais|ate mais|adeus|bye|falou|valeu)\b/i,
  /^(obrigad[oa]|brigad[oa]|valeu|thanks|agradeço)\b/i,
  /^(tudo bem|como vai|beleza|tranquilo|show|massa)\b/i,
  /^(quem é você|o que você faz|como funciona|me ajuda|help)\b/i,
];

function classifyIntent(message: string): Intent {
  const trimmed = message.trim();
  const wordCount = trimmed.split(/\s+/).length;

  for (const pattern of CONVERSATIONAL_PATTERNS) {
    if (pattern.test(trimmed)) {
      return wordCount <= 8 ? "conversational" : "technical";
    }
  }
  return "technical";
}

const HISTORY_LIMIT = 10;

async function loadConversationHistory(
  conversationId: string
): Promise<HistoryMessage[]> {
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (!data || data.length === 0) return [];

  return data.reverse().map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
}

export async function processQuery(
  userId: string,
  message: string,
  conversationId: string | null
): Promise<ChatResult> {
  const supabase = getSupabaseAdmin();

  // 1. Get or create conversation
  if (!conversationId) {
    const title = message.length > 80 ? message.slice(0, 80) + "..." : message;
    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: userId, title })
      .select("id")
      .single();

    conversationId = data!.id;
  }

  // TypeScript narrowing: conversationId is guaranteed non-null after the block above
  const convId = conversationId!;

  // 2. Classify intent
  const intent = classifyIntent(message);

  // 3. Load conversation history (BEFORE saving current message to avoid duplication)
  const history = await loadConversationHistory(convId);

  // 4. Save user message
  await supabase
    .from("messages")
    .insert({ conversation_id: convId, role: "user", content: message });

  let responseText: string;
  let sources: SourceInfo[] = [];

  if (intent === "conversational") {
    // 5a. Conversational: skip embedding/search, respond directly
    responseText = await generateConversationalResponse(message, history);
  } else {
    // 5b. Technical: full RAG pipeline
    const queryEmbedding = await getEmbedding(message);
    const chunks = await searchSimilarChunks(queryEmbedding);

    if (chunks.length > 0) {
      responseText = await generateResponse(message, chunks, history);
    } else {
      responseText =
        "Não encontrei informações relevantes nas normas técnicas disponíveis " +
        "para responder sua pergunta. Tente reformular ou pergunte sobre outro tema " +
        "relacionado a normas laboratoriais.";
    }

    // Build sources
    sources = chunks.slice(0, 5).map((chunk) => ({
      document_name: chunk.doc_name || "",
      section: chunk.section_title ?? null,
      page: chunk.page_start ?? null,
      similarity: Math.round(chunk.similarity * 1000) / 1000,
    }));
  }

  // 6. Save assistant message
  const { data: msgData } = await supabase
    .from("messages")
    .insert({
      conversation_id: convId,
      role: "assistant",
      content: responseText,
      sources: sources.length > 0 ? sources : null,
    })
    .select("id")
    .single();

  // 7. Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", convId);

  return {
    message: responseText,
    conversation_id: convId,
    message_id: msgData!.id,
    sources,
  };
}
