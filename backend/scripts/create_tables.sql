-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'analyst'
    CHECK (role IN ('analyst', 'support', 'coordinator', 'admin')),
  department TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Documents (indexed norms)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  total_pages INTEGER,
  total_chunks INTEGER,
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Document chunks with embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL,
  page_start INTEGER,
  page_end INTEGER,
  section_title TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search column
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS fts tsvector;

-- HNSW index for vector search (better recall than IVFFlat)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding
  ON document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

CREATE INDEX IF NOT EXISTS idx_chunks_document
  ON document_chunks (document_id);

-- GIN index for full-text search
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

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own conversations"
  ON conversations FOR ALL USING (auth.uid() = user_id);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::JSONB,
  feedback TEXT CHECK (feedback IN ('like', 'dislike')),
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT USING (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own messages"
  ON messages FOR INSERT WITH CHECK (
    conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
  );

-- Vector search function (fallback)
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

-- Hybrid search function (vector + full-text)
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
