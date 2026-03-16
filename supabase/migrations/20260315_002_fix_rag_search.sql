-- Migration: Fix RAG Search Reliability
-- Story 1.1 — AC1 (HNSW index), AC2 (hybrid search), AC7 (threshold)
-- Date: 2026-03-15

-- ============================================================
-- AC1: Migrate from IVFFlat to HNSW index
-- ============================================================

-- Drop old IVFFlat index
DROP INDEX IF EXISTS idx_chunks_embedding;

-- Create HNSW index (better recall than IVFFlat for this use case)
CREATE INDEX idx_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- ============================================================
-- AC2: Add full-text search support for hybrid search
-- ============================================================

-- Add tsvector column for full-text search
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS fts tsvector;

-- Populate fts column for existing rows
UPDATE document_chunks
  SET fts = to_tsvector('portuguese', content)
  WHERE fts IS NULL;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_fts
  ON document_chunks USING gin (fts);

-- Auto-populate fts on insert/update
CREATE OR REPLACE FUNCTION update_chunks_fts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.fts := to_tsvector('portuguese', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chunks_fts ON document_chunks;
CREATE TRIGGER trg_chunks_fts
  BEFORE INSERT OR UPDATE OF content ON document_chunks
  FOR EACH ROW EXECUTE FUNCTION update_chunks_fts();

-- ============================================================
-- AC7: Update search_chunks default threshold from 0.7 to 0.3
-- ============================================================

CREATE OR REPLACE FUNCTION search_chunks(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  section_title TEXT,
  page_start INTEGER,
  page_end INTEGER,
  similarity FLOAT,
  doc_name TEXT,
  doc_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set HNSW search parameter for better recall
  PERFORM set_config('hnsw.ef_search', '100', true);

  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.section_title,
    dc.page_start,
    dc.page_end,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.name AS doc_name,
    d.doc_type
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- AC2: Hybrid search function (vector + full-text)
-- ============================================================

CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  query_embedding VECTOR(768),
  query_text TEXT,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  section_title TEXT,
  page_start INTEGER,
  page_end INTEGER,
  similarity FLOAT,
  doc_name TEXT,
  doc_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set HNSW search parameter for better recall
  PERFORM set_config('hnsw.ef_search', '100', true);

  RETURN QUERY
  WITH vector_results AS (
    SELECT
      dc.id,
      dc.document_id,
      dc.content,
      dc.section_title,
      dc.page_start,
      dc.page_end,
      1 - (dc.embedding <=> query_embedding) AS vector_score,
      d.name AS doc_name,
      d.doc_type
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE 1 - (dc.embedding <=> query_embedding) > match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  fts_results AS (
    SELECT
      dc.id,
      ts_rank_cd(dc.fts, websearch_to_tsquery('portuguese', query_text)) AS fts_score
    FROM document_chunks dc
    WHERE dc.fts @@ websearch_to_tsquery('portuguese', query_text)
  ),
  combined AS (
    SELECT
      vr.id,
      vr.document_id,
      vr.content,
      vr.section_title,
      vr.page_start,
      vr.page_end,
      -- Weighted combination: 70% vector + 30% FTS (normalized)
      (0.7 * vr.vector_score) +
      (0.3 * COALESCE(fr.fts_score / NULLIF(MAX(fr.fts_score) OVER (), 0), 0))
        AS similarity,
      vr.doc_name,
      vr.doc_type
    FROM vector_results vr
    LEFT JOIN fts_results fr ON fr.id = vr.id
  )
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.section_title,
    c.page_start,
    c.page_end,
    c.similarity,
    c.doc_name,
    c.doc_type
  FROM combined c
  ORDER BY c.similarity DESC
  LIMIT match_count;
END;
$$;
