-- Migration 015 : un seul compte par courriel, sans tenir compte de la casse (bloc 17)
-- La contrainte UNIQUE d'origine distingue « Camille@x.com » et « camille@x.com ».
-- L'inscription enregistre maintenant le courriel en minuscules ; cet index empêche aussi
-- un doublon de casse au niveau de la base.
-- Si la base contient DÉJÀ deux comptes qui ne diffèrent que par la casse, l'index n'est pas
-- créé (un avis l'indique) : il faut d'abord corriger ces comptes à la main.
-- Idempotente : peut être rejouée sans erreur.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users GROUP BY LOWER(email) HAVING COUNT(*) > 1) THEN
    RAISE NOTICE 'Index users_email_lower non créé : des comptes ne diffèrent que par la casse du courriel.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower ON users (LOWER(email));
  END IF;
END $$;
