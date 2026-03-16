import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getEmbedding } from "./embedding";
import { searchSimilarChunks } from "./vector";
import {
  generateResponse,
  generateConversationalResponse,
  generateFallbackResponse,
  getAnthropicClient,
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

async function expandQuery(query: string): Promise<string | null> {
  const wordCount = query.trim().split(/\s+/).length;
  if (wordCount > 10) return null;

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      temperature: 0.0,
      system:
        "Expanda esta consulta tecnica para melhorar a busca semantica. " +
        "Inclua sinonimos, siglas expandidas e termos relacionados. " +
        "Responda APENAS com a query expandida, sem explicacoes.",
      messages: [{ role: "user", content: query }],
    });

    const block = response.content[0];
    return block.type === "text" ? block.text : null;
  } catch {
    return null;
  }
}

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

  const convId = conversationId!;

  // 2. Classify intent
  const intent = classifyIntent(message);

  // 3. Load conversation history
  const history = await loadConversationHistory(convId);

  // 4. Save user message
  await supabase
    .from("messages")
    .insert({ conversation_id: convId, role: "user", content: message });

  let responseText: string;
  let sources: SourceInfo[] = [];

  if (intent === "conversational") {
    responseText = await generateConversationalResponse(message, history);
  } else {
    // 5b. Technical: full RAG pipeline with query expansion + hybrid search
    const expandedQuery = await expandQuery(message);
    const searchText = expandedQuery || message;

    const queryEmbedding = await getEmbedding(searchText);
    const chunks = await searchSimilarChunks(queryEmbedding, message);

    if (chunks.length > 0) {
      responseText = await generateResponse(message, chunks, history);
    } else {
      responseText = await generateFallbackResponse(message, history);
    }

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
