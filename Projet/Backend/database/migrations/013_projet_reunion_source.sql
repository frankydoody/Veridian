-- Migration 013 : réunion qui a créé un projet (bloc 21)
-- L'analyse d'une réunion peut créer un projet ; la page de la réunion l'affiche « nouveau ».
-- Idempotente : peut être rejouée sans erreur.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS source_meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL;
