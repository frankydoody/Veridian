// src/config/security.js
// Bloc 17 — Réglages de sécurité de l'API, lus dans l'environnement (.env).
//
//  - CORS : seules les origines listées dans FRONTEND_URL peuvent appeler l'API depuis un navigateur.
//  - Limitation de débit sur la connexion et l'inscription (essais de mots de passe en rafale).
//  - Vérification de la configuration au démarrage : sans secret JWT solide, le serveur refuse
//    de démarrer plutôt que de signer des jetons avec une valeur vide ou devinable.
import rateLimit from 'express-rate-limit';

const DEFAULT_FRONTEND_URL = 'http://localhost:5173';
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Origines autorisées : FRONTEND_URL, une ou plusieurs adresses séparées par des virgules.
 * « http://localhost:5173/ » et « http://localhost:5173 » sont équivalentes (barre finale retirée).
 */
export const allowedOrigins = (value = process.env.FRONTEND_URL) =>
  (value || DEFAULT_FRONTEND_URL)
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

/**
 * CORS : l'en-tête Access-Control-Allow-Origin n'est renvoyé QUE pour une origine autorisée.
 * Une autre origine ne reçoit pas l'en-tête : le navigateur bloque alors la lecture de la réponse.
 * (Les appels sans navigateur, comme curl ou les tests, n'envoient pas d'Origin et ne sont pas concernés.)
 */
export const corsMiddleware = (origins = allowedOrigins()) => (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && origins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Le frontend lit le nom du fichier PDF dans Content-Disposition
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(origin && origins.includes(origin) ? 204 : 403);
  next();
};

const positiveInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Limiteur pour /api/auth/login et /api/auth/register.
 * Par défaut : 20 essais par adresse IP et par fenêtre de 15 minutes (AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MIN).
 * Au-delà : 429 avec un message en français et l'en-tête RateLimit (délai avant de réessayer).
 */
export const createAuthLimiter = ({
  max = positiveInt(process.env.AUTH_RATE_LIMIT, 20),
  windowMinutes = positiveInt(process.env.AUTH_RATE_WINDOW_MIN, 15),
} = {}) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit: max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: `Trop de tentatives. Réessayez dans ${windowMinutes} minutes.` },
});

/**
 * Problèmes de configuration qui empêchent un démarrage sûr.
 * @returns {string[]} messages en français (tableau vide si tout va bien)
 */
export const checkSecurityConfig = (env = process.env) => {
  const problems = [];
  const secret = env.JWT_SECRET ?? '';
  if (!secret) {
    problems.push('JWT_SECRET est vide : relancez le script de démarrage (il en génère un) ou ajoutez-en un dans Projet/Backend/.env.');
  } else if (secret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET est trop court (${secret.length} caractères, ${MIN_JWT_SECRET_LENGTH} au minimum) : un secret court se devine.`);
  }
  return problems;
};
