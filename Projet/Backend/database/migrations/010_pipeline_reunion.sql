-- Migration 010 : pipeline d'analyse automatique d'une réunion (bloc 19)
-- Idempotente : peut être rejouée sans erreur.

-- 1. Tâches liées à un acteur (utilisateur) + date estimée par l'IA
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_estimated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source        VARCHAR(10) NOT NULL DEFAULT 'manual';
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);

-- 2. État de l'analyse IA d'une réunion
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS analysis_error  TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS analyzed_at     TIMESTAMPTZ;
DO $$ BEGIN
  ALTER TABLE meetings ADD CONSTRAINT meetings_analysis_status_check
    CHECK (analysis_status IN ('none', 'processing', 'done', 'error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Risques et problèmes possibles détectés par l'IA sur un projet existant
CREATE TABLE IF NOT EXISTS mtg_risks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  kind        VARCHAR(20) NOT NULL DEFAULT 'risque'
              CHECK (kind IN ('risque', 'incoherence', 'echeance', 'dependance')),
  description TEXT NOT NULL,
  severity    VARCHAR(10) NOT NULL DEFAULT 'medium'
              CHECK (severity IN ('low', 'medium', 'high')),
  mitigation  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mtg_risks_project ON mtg_risks(project_id);
CREATE INDEX IF NOT EXISTS idx_mtg_risks_meeting ON mtg_risks(meeting_id);

-- 4. Journal des courriels envoyés (ou simulés) après l'analyse
CREATE TABLE IF NOT EXISTS mtg_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  email       VARCHAR(255) NOT NULL,
  subject     TEXT NOT NULL,
  kind        VARCHAR(10) NOT NULL DEFAULT 'actor' CHECK (kind IN ('actor', 'summary')),
  status      VARCHAR(10) NOT NULL CHECK (status IN ('sent', 'logged', 'failed')),
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mtg_notifications_meeting ON mtg_notifications(meeting_id);
