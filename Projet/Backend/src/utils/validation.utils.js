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

/**
 * Bloc 16 — Date et heure prévues d'une réunion (date ISO complète, ex. « 2026-12-05T14:30:00.000Z »).
 * Le navigateur convertit l'heure locale saisie en ISO (UTC) : le serveur n'a pas à deviner le fuseau.
 * Une date seule (« AAAA-MM-JJ ») est acceptée et placée à midi UTC, pour rester sur le même jour.
 * @returns {{ value: Date|null, error: string|null }}
 */
export const parseScheduledAt = (value) => {
  if (value === undefined || value === null || value === '') return { value: null, error: null };
  if (typeof value !== 'string') return { value: null, error: 'Date de réunion invalide' };
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return { value: null, error: 'Date de réunion invalide' };
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2100) return { value: null, error: 'Date de réunion hors limites' };
  return { value: date, error: null };
};

// Plage maximale lue par le calendrier : une vue mensuelle couvre 6 semaines (42 jours).
export const CALENDAR_MAX_DAYS = 92;

const isCalendarDay = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  // Refuse les jours qui n'existent pas (« 2026-02-31 » deviendrait le 3 mars)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

/**
 * Bloc 16 — Plage de dates du calendrier : deux jours « AAAA-MM-JJ », bornes incluses.
 * Bornée pour qu'une requête ne puisse pas demander des années de données d'un coup.
 * @returns {{ from: string|null, to: string|null, error: string|null }}
 */
export const parseCalendarRange = (from, to) => {
  if (!from || !to) return { from: null, to: null, error: 'Les paramètres from et to sont obligatoires (AAAA-MM-JJ)' };
  if (!isCalendarDay(from) || !isCalendarDay(to)) return { from: null, to: null, error: 'Date invalide (format attendu : AAAA-MM-JJ)' };
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (days < 0) return { from: null, to: null, error: 'La date de fin doit suivre la date de début' };
  if (days > CALENDAR_MAX_DAYS) return { from: null, to: null, error: `Plage trop longue (${CALENDAR_MAX_DAYS} jours au maximum)` };
  return { from, to, error: null };
};

// ─── Bloc 17 : inscription ───────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = 8;
// bcrypt n'utilise que les 72 premiers OCTETS du mot de passe : au-delà, la fin serait ignorée
// sans que l'utilisateur le sache. On refuse plutôt que d'accepter un mot de passe tronqué.
export const PASSWORD_MAX_BYTES = 72;

/**
 * Valide les champs d'inscription ; le courriel est rendu en minuscules.
 * @returns {{ value: { name, email, password }|null, error: string|null }}
 */
export const validateRegistration = ({ name, email, password } = {}) => {
  if (!name || !email || !password) {
    return { value: null, error: 'Tous les champs sont obligatoires (name, email, password)' };
  }
  const nameField = cleanText(name, { label: 'Le nom', max: 100, required: true });
  if (nameField.error) return { value: null, error: nameField.error };
  if (!isEmail(email)) return { value: null, error: 'Adresse courriel invalide' };
  if (typeof password !== 'string') return { value: null, error: 'Le mot de passe doit être du texte' };
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { value: null, error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` };
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return { value: null, error: `Le mot de passe est trop long (${PASSWORD_MAX_BYTES} octets au maximum)` };
  }
  return { value: { name: nameField.value, email: normalizeEmail(email), password }, error: null };
};
