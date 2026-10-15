-- Migration 001: Mise à jour dimension vecteur 1536 → 768 (Gemini embeddings)
--
-- Cette migration ne concerne que les bases créées avec l'ancienne table
-- "memory_chunks" (première intégration, 1536 dimensions). Sur une base neuve
-- (schema.sql, puis migrations), cette table n'existe pas : la migration ne
-- fait alors rien. La migration 007 recrée de toute façon la mémoire
-- vectorielle sous le nom "mtg_memory_chunks" avec 768 dimensions.

DO $$
BEGIN
  IF to_regclass('public.memory_chunks') IS NOT NULL THEN
    EXECUTE 'DROP INDEX IF EXISTS idx_memory_chunks_embedding';
    EXECUTE 'ALTER TABLE memory_chunks ALTER COLUMN embedding TYPE vector(768)';
    EXECUTE 'CREATE INDEX idx_memory_chunks_embedding
               ON memory_chunks USING hnsw (embedding vector_cosine_ops)';
  END IF;
END
$$;
