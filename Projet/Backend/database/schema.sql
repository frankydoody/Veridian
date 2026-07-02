-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member')),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Table: projects
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'archived', 'inactive')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: project_members
CREATE TABLE IF NOT EXISTS project_members (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  role        VARCHAR(20) NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'member')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- Table: meetings
CREATE TABLE IF NOT EXISTS meetings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned', 'active', 'processing', 'done', 'cancelled')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  audio_path  VARCHAR(500),
  started_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: participants
CREATE TABLE IF NOT EXISTS participants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id   UUID NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  user_id      UUID REFERENCES users(id) ON DELETE RESTRICT,
  display_name VARCHAR(100) NOT NULL,
  role         VARCHAR(20) NOT NULL DEFAULT 'attendee'
               CHECK (role IN ('host', 'attendee')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: transcriptions
CREATE TABLE IF NOT EXISTS transcriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id  UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE RESTRICT,
  raw_text    TEXT NOT NULL,
  language    VARCHAR(10) NOT NULL DEFAULT 'fr',
  is_edited   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: decisions
CREATE TABLE IF NOT EXISTS decisions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id    UUID NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  content       TEXT NOT NULL,
  context       TEXT,
  responsible   VARCHAR(150),
  alternatives  TEXT[],
  confidence    INTEGER NOT NULL DEFAULT 100
                CHECK (confidence BETWEEN 0 AND 100),
  status        VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('draft', 'confirmed', 'contradicted', 'inactive')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: memory_chunks
CREATE TABLE IF NOT EXISTS memory_chunks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  decision_id  UUID NOT NULL REFERENCES decisions(id) ON DELETE RESTRICT,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  content      TEXT NOT NULL,
  embedding    vector(1536),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index HNSW pour recherche vectorielle rapide
CREATE INDEX IF NOT EXISTS idx_memory_chunks_embedding
  ON memory_chunks USING hnsw (embedding vector_cosine_ops);


-- Table: alerts
CREATE TABLE IF NOT EXISTS alerts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  new_decision_id      UUID NOT NULL REFERENCES decisions(id) ON DELETE RESTRICT,
  conflict_decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE RESTRICT,
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  explanation          TEXT NOT NULL,
  severity             VARCHAR(10) NOT NULL DEFAULT 'medium'
                       CHECK (severity IN ('low', 'medium', 'high')),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  resolved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_meetings_project_id
  ON meetings(project_id);

CREATE INDEX IF NOT EXISTS idx_decisions_project_id
  ON decisions(project_id);

CREATE INDEX IF NOT EXISTS idx_decisions_meeting_id
  ON decisions(meeting_id);

CREATE INDEX IF NOT EXISTS idx_alerts_project_id
  ON alerts(project_id);

CREATE INDEX IF NOT EXISTS idx_memory_chunks_project
  ON memory_chunks(project_id);


