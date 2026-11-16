// src/utils/validation.utils.js
// Validation des entrées des formulaires (bloc 13). Fonctions pures : testables sans base.
//
// Pourquoi valider les UUID ? Un identifiant mal formé envoyé à PostgreSQL provoque
// l'erreur 22P02 (« invalid input syntax for type uuid »), donc une réponse 500.
// On répond plutôt 400 : c'est une erreur du client, pas du serveur.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Volontairement simple : une partie locale, un @, un domaine avec un point.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

export const isEmail = (value) => typeof value === 'string' && value.length <= 255 && EMAIL_RE.test(value.trim());

export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Texte obligatoire ou facultatif, nettoyé et borné.
 * @returns {{ value: string|null, error: string|null }}
 */
export const cleanText = (value, { label, max, required = false }) => {
  if (value === undefined || value === null || String(value).trim() === '') {
    return required
      ? { value: null, error: `${label} est obligatoire` }
      : { value: null, error: null };
  }
  if (typeof value !== 'string') return { value: null, error: `${label} doit être du texte` };
  const text = value.trim();
  if (text.length > max) return { value: null, error: `${label} ne doit pas dépasser ${max} caractères` };
  return { value: text, error: null };
};

/**
 * Date d'échéance : « AAAA-MM-JJ » (formulaire) ou date ISO complète.
 * Une date sans heure est fixée à 17 h UTC, comme dans le pipeline d'analyse (voir BUG-03),
 * pour qu'elle reste sur le même jour dans tous les fuseaux.
 * @returns {{ value: Date|null, error: string|null }}
 */
export const parseDueDate = (value) => {
  if (value === undefined || value === null || value === '') return { value: null, error: null };
  if (typeof value !== 'string') return { value: null, error: 'Date d\'échéance invalide' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T17:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return { value: null, error: 'Date d\'échéance invalide' };
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2100) return { value: null, error: 'Date d\'échéance hors limites' };
  return { value: date, error: null };
};

export const TASK_PRIORITIES = ['haute', 'moyenne', 'basse'];
export const TASK_STATUSES = ['todo', 'in_progress', 'done'];
