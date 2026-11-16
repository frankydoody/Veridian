-- Migration 011 : suppression logique des tâches (bloc 13)
-- Comme les autres tables, une tâche supprimée n'est jamais effacée : is_active passe à false.
-- Idempotente : peut être rejouée sans erreur.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- La plupart des lectures ne visent que les tâches actives d'un projet
CREATE INDEX IF NOT EXISTS idx_tasks_project_active ON tasks(project_id) WHERE is_active = true;
