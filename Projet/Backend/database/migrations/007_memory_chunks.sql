-- migrations/007_memory_chunks.sql
-- Bloc 07 — Mémoire vectorielle RAG
-- Requiert: PostgreSQL 16 + pgvector

-- Active l'extension pgvector (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS memory_chunks;

-- Table principale des chunks de mémoire
CREATE TABLE IF NOT EXISTS mtg_memory_chunks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id  UUID        NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  project_id  UUID        NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  chunk_text  TEXT        NOT NULL,
  chunk_type  VARCHAR(50) NOT NULL DEFAULT 'transcription'
              CHECK (chunk_type IN ('transcription', 'decision', 'summary')),
  embedding   vector(768) NOT NULL,
  metadata    JSONB       NOT NULL DEFAULT '{}',
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour filtrage par réunion et projet
CREATE INDEX IF NOT EXISTS idx_memory_chunks_meeting_id
  ON mtg_memory_chunks(meeting_id);

CREATE INDEX IF NOT EXISTS idx_memory_chunks_project_id
  ON mtg_memory_chunks(project_id);

CREATE INDEX IF NOT EXISTS idx_memory_chunks_type
  ON mtg_memory_chunks(chunk_type);

-- Index ivfflat pour la recherche par similarité cosinus
CREATE INDEX IF NOT EXISTS idx_memory_chunks_embedding
  ON mtg_memory_chunks USING hnsw (embedding vector_cosine_ops);

-- Commentaires documentaires
COMMENT ON TABLE mtg_memory_chunks IS
  'Chunks de mémoire vectorielle extraits des transcriptions et décisions';
COMMENT ON COLUMN mtg_memory_chunks.embedding IS
  'Vecteur 768 dimensions généré par Gemini text-embedding-004';
COMMENT ON COLUMN mtg_memory_chunks.chunk_type IS
  'Type: transcription | decision | summary';
