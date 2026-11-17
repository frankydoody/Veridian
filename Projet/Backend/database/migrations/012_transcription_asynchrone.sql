-- Migration 012 : transcription en arrière-plan (bloc 20)
-- L'envoi d'un audio répond tout de suite (202) ; Whisper tourne ensuite en arrière-plan.
-- Ces colonnes rendent l'état visible : none | processing | done | error (+ message d'erreur).
-- Idempotente : peut être rejouée sans erreur.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcription_status VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS transcription_error  TEXT;

DO $$ BEGIN
  ALTER TABLE meetings ADD CONSTRAINT meetings_transcription_status_check
    CHECK (transcription_status IN ('none', 'processing', 'done', 'error'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Les réunions déjà transcrites avant cette migration sont « done »
UPDATE meetings m
SET transcription_status = 'done'
WHERE m.transcription_status = 'none'
  AND EXISTS (SELECT 1 FROM transcriptions t WHERE t.meeting_id = m.id AND t.is_active = true);
