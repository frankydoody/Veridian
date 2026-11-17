import { describe, test, expect, jest } from '@jest/globals';
import {
  allowedOrigins, corsMiddleware, checkSecurityConfig, MIN_JWT_SECRET_LENGTH,
} from '../../src/config/security.js';
import { validateRegistration } from '../../src/utils/validation.utils.js';
import { errorMiddleware } from '../../src/middlewares/error.middleware.js';

// Bloc 17 — Réglages de sécurité, validation de l'inscription, gestionnaire d'erreurs
const makeRes = () => {
  const res = { headers: {} };
  res.setHeader = jest.fn((k, v) => { res.headers[k] = v; });
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
};

describe('allowedOrigins (FRONTEND_URL)', () => {
  test('par défaut : le serveur de développement Vite', () => {
    expect(allowedOrigins('')).toEqual(['http://localhost:5173']);
  });
  test('plusieurs origines séparées par des virgules, barre finale retirée', () => {
    expect(allowedOrigins('https://veridian.example/, http://localhost:5173 ')).toEqual(['https://veridian.example', 'http://localhost:5173']);
  });
});

describe('corsMiddleware', () => {
  const cors = corsMiddleware(['http://localhost:5173']);

  test('origine autorisée : en-têtes CORS renvoyés', () => {
    const res = makeRes();
    const next = jest.fn();
    cors({ method: 'GET', headers: { origin: 'http://localhost:5173' } }, res, next);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(next).toHaveBeenCalled();
  });

  test('autre origine : aucun en-tête, pré-vérification refusée (403)', () => {
    const res = makeRes();
    cors({ method: 'OPTIONS', headers: { origin: 'https://pirate.example' } }, res, jest.fn());
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(res.sendStatus).toHaveBeenCalledWith(403);
  });

  test('pré-vérification d\'une origine autorisée → 204', () => {
    const res = makeRes();
    cors({ method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }, res, jest.fn());
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });

  test('sans en-tête Origin (curl, tests) : la requête passe', () => {
    const next = jest.fn();
    cors({ method: 'GET', headers: {} }, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('checkSecurityConfig', () => {
  test('secret absent ou trop court → problème signalé', () => {
    expect(checkSecurityConfig({})).toEqual([expect.stringMatching(/JWT_SECRET est vide/)]);
    expect(checkSecurityConfig({ JWT_SECRET: 'court' })).toEqual([expect.stringMatching(/trop court/)]);
  });
  test('secret assez long → aucun problème', () => {
    expect(checkSecurityConfig({ JWT_SECRET: 'x'.repeat(MIN_JWT_SECRET_LENGTH) })).toEqual([]);
  });
});

describe('validateRegistration', () => {
  test('valeurs nettoyées, courriel en minuscules', () => {
    expect(validateRegistration({ name: ' Julie ', email: ' Julie@Exemple.CA ', password: 'motdepasse' }))
      .toEqual({ value: { name: 'Julie', email: 'julie@exemple.ca', password: 'motdepasse' }, error: null });
  });
  test('mot de passe : 8 caractères au minimum, 72 octets au maximum', () => {
    expect(validateRegistration({ name: 'J', email: 'j@x.ca', password: '1234567' }).error).toMatch(/au moins 8/);
    expect(validateRegistration({ name: 'J', email: 'j@x.ca', password: 'a'.repeat(72) }).error).toBeNull();
    // 37 « é » = 74 octets en UTF-8 : bcrypt ignorerait la fin
    expect(validateRegistration({ name: 'J', email: 'j@x.ca', password: 'é'.repeat(37) }).error).toMatch(/trop long/);
  });
});

describe('errorMiddleware', () => {
  const req = { method: 'GET', originalUrl: '/api/x' };
  const silence = () => jest.spyOn(console, 'error').mockImplementation(() => {});

  test('erreur interne : message générique, jamais le détail ni la trace', () => {
    const spy = silence();
    const res = makeRes();
    errorMiddleware(new Error('relation "secret_table" does not exist'), req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Erreur interne du serveur' });
    spy.mockRestore();
  });

  test('valeur refusée par PostgreSQL (22P02) → 400', () => {
    const spy = silence();
    const res = makeRes();
    errorMiddleware(Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' }), req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    spy.mockRestore();
  });

  test('erreur client (status < 500) : son message est conservé', () => {
    const spy = silence();
    const res = makeRes();
    errorMiddleware(Object.assign(new Error('Fichier trop gros'), { status: 413 }), req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ message: 'Fichier trop gros' });
    spy.mockRestore();
  });

  test('corps JSON mal formé ou trop gros', () => {
    const res = makeRes();
    errorMiddleware({ type: 'entity.parse.failed' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    errorMiddleware({ type: 'entity.too.large' }, req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(413);
  });
});
