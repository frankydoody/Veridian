-- Migration 003 : Table des tâches
-- Les tâches sont extraites des réunions (par l'IA) ou créées manuellement

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,

  -- Qui doit faire cette tâche (texte libre pour l'instant)
  assignee    TEXT,

  -- Priorité : haute | moyenne | basse
  priority    VARCHAR(10) DEFAULT 'moyenne'
                CHECK (priority IN ('haute', 'moyenne', 'basse')),

  -- Statut : todo | in_progress | done
  status      VARCHAR(20) DEFAULT 'todo'
                CHECK (status IN ('todo', 'in_progress', 'done')),

  -- Lien vers la réunion source (peut être NULL si tâche manuelle)
  meeting_id  UUID REFERENCES meetings(id) ON DELETE SET NULL,

  -- Lien vers le projet
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Propriétaire (créateur de la tâche ou qui l'a importée)
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  due_date    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour accélérer les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS idx_tasks_user_id    ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_meeting_id ON tasks(meeting_id);
