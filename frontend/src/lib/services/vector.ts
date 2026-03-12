import { getSupabaseAdmin } from "@/lib/supabase/server";

const SIMILARITY_THRESHOLD = 0.5;
const MAX_CHUNKS = 8;

export interface ChunkResult {
  doc_name: string;
  section_title: string | null;
  page_start: number | null;
  content: string;
  similarity: number;
}

export async function searchSimilarChunks(
  queryEmbedding: number[]
): Promise<ChunkResult[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.rpc("search_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: SIMILARITY_THRESHOLD,
    match_count: MAX_CHUNKS,
  });

  if (error) {
    console.error("Vector search error:", error);
    return [];
  }

  return (data as ChunkResult[]) || [];
}
