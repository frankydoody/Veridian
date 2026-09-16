-- Migration 001: Mise à jour dimension vecteur 1536 → 768 (Gemini embeddings)

DROP INDEX IF EXISTS idx_memory_chunks_embedding;

ALTER TABLE memory_chunks
  ALTER COLUMN embedding TYPE vector(768);

CREATE INDEX idx_memory_chunks_embedding
  ON memory_chunks USING hnsw (embedding vector_cosine_ops);