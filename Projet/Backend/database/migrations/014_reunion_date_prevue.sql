-- Migration 014 : date prévue d'une réunion (bloc 16, calendrier)
-- Une réunion peut être planifiée à l'avance ; le calendrier la place à cette date.
-- Sans date prévue, le calendrier utilise le début réel (started_at), sinon la création.
-- Idempotente : peut être rejouée sans erreur.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Le calendrier lit les réunions par plage de dates
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at ON meetings (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);
