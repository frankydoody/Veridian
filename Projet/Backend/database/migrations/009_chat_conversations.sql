-- migrations/009_chat_conversations.sql
-- Bloc 09 — Historique du chat mémoire
-- Une conversation appartient à UN utilisateur et à UN projet : chaque membre
-- garde son propre historique, même quand il pose des questions sur un projet partagé.

CREATE TABLE IF NOT EXISTS mtg_chat_conversations (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID         NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title       VARCHAR(200) NOT NULL DEFAULT 'Nouvelle conversation',
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mtg_chat_messages (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id  UUID        NOT NULL REFERENCES mtg_chat_conversations(id) ON DELETE RESTRICT,
  role             VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
  content          TEXT        NOT NULL,
  sources          JSONB       NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_project
  ON mtg_chat_conversations(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
  ON mtg_chat_messages(conversation_id, created_at);

COMMENT ON TABLE mtg_chat_conversations IS
  'Conversations du chat mémoire (une par utilisateur et par projet)';
COMMENT ON COLUMN mtg_chat_messages.sources IS
  'Sources RAG ayant servi à une réponse : [{meetingId, meetingTitle, chunkType, similarity}]';
