import { getSupabaseAdmin } from "@/lib/supabase/server";

const SIMILARITY_THRESHOLD = 0.3;
const MAX_CHUNKS = 15;

export interface ChunkResult {
  doc_name: string;
  section_title: string | null;
  page_start: number | null;
  content: string;
  similarity: number;
}

export async function searchSimilarChunks(
  queryEmbedding: number[],
  queryText: string
): Promise<ChunkResult[]> {
  const supabase = getSupabaseAdmin();

  // Try hybrid search first (vector + full-text)
  const { data, error } = await supabase.rpc("hybrid_search_chunks", {
    query_embedding: queryEmbedding,
    query_text: queryText,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: MAX_CHUNKS,
  });

  if (error) {
    console.error("Hybrid search error, falling back to vector-only:", error);

    // Fallback to vector-only search
    const fallback = await supabase.rpc("search_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: SIMILARITY_THRESHOLD,
      match_count: MAX_CHUNKS,
    });

    if (fallback.error) {
      console.error("Vector search fallback error:", fallback.error);
      return [];
    }

    return (fallback.data as ChunkResult[]) || [];
  }

  return (data as ChunkResult[]) || [];
}
