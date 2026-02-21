import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getEmbedding } from "./embedding";
import { searchSimilarChunks } from "./vector";
import { generateResponse } from "./llm";

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

  // 2. Save user message
  await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, role: "user", content: message });

  // 3. Generate embedding for the query
  const queryEmbedding = await getEmbedding(message);

  // 4. Search for similar chunks
  const chunks = await searchSimilarChunks(queryEmbedding);

  // 5. Generate response with Claude
  let responseText: string;
  if (chunks.length > 0) {
    responseText = await generateResponse(message, chunks);
  } else {
    responseText =
      "Não encontrei informações relevantes nas normas técnicas disponíveis " +
      "para responder sua pergunta. Tente reformular ou pergunte sobre outro tema " +
      "relacionado a normas laboratoriais.";
  }

  // 6. Build sources
  const sources: SourceInfo[] = chunks.slice(0, 5).map((chunk) => ({
    document_name: chunk.doc_name || "",
    section: chunk.section_title ?? null,
    page: chunk.page_start ?? null,
    similarity: Math.round(chunk.similarity * 1000) / 1000,
  }));

  // 7. Save assistant message
  const { data: msgData } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      role: "assistant",
      content: responseText,
      sources: sources,
    })
    .select("id")
    .single();

  // 8. Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return {
    message: responseText,
    conversation_id: conversationId!,
    message_id: msgData!.id,
    sources,
  };
}
