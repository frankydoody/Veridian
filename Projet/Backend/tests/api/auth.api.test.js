// tests/api/auth.api.test.js — Bloc 17
// Inscription, connexion et sécurité de l'API, sur la VRAIE base de test (veridian_test).
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';

const { default: app } = await import('../../app.js');
const { default: pool, query } = await import('../../src/config/db.js');
const { createAuthLimiter } = await import('../../src/config/security.js');
const { makeClient, unique, PASSWORD } = await import('./helpers.js');

const { register, as } = makeClient(app);
const post = (url, body) => request(app).post(url).send(body);

afterAll(async () => { await pool.end(); });

describe('Inscription', () => {
  test('compte créé : jeton, utilisateur sans mot de passe ni empreinte', async () => {
    const email = `Nouveau-${unique()}@Example.TEST`;
    const res = await post('/api/auth/register', { name: '  Nouveau Compte ', email, password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ name: 'Nouveau Compte', email: email.toLowerCase(), role: 'member' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    // Le mot de passe est stocké haché (bcrypt), jamais en clair
    const row = (await query('SELECT password_hash FROM users WHERE id = $1', [res.body.user.id])).rows[0];
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);
    expect(row.password_hash).not.toContain(PASSWORD);
  });

  test.each([
    [{ email: 'a@b.test', password: PASSWORD }, /obligatoires/],
    [{ name: 'A', email: 'pas-un-courriel', password: PASSWORD }, /courriel invalide/],
    [{ name: 'A', email: 'court@example.test', password: 'court' }, /au moins 8/],
    [{ name: 'A', email: 'long@example.test', password: 'é'.repeat(40) }, /trop long/],
    [{ name: 'x'.repeat(101), email: 'nom@example.test', password: PASSWORD }, /100/],
    [{ name: 'A', email: 'type@example.test', password: 12345678 }, /texte/],
  ])('champs invalides → 400 (%#)', async (body, message) => {
    const res = await post('/api/auth/register', body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  test('courriel déjà utilisé, même avec une autre casse → 409', async () => {
    const account = await register('Doublon');
    const res = await post('/api/auth/register', { name: 'Autre', email: account.email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(409);
  });
});

describe('Connexion', () => {
  let account;
  beforeAll(async () => { account = await register('Connexion'); });

  test('bons identifiants (courriel en majuscules accepté) → 200 et jeton', async () => {
    const res = await post('/api/auth/login', { email: account.email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(account.user.id);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test('mauvais mot de passe et courriel inconnu : même réponse 401', async () => {
    const wrong = await post('/api/auth/login', { email: account.email, password: 'mauvais-mot-de-passe' });
    const unknown = await post('/api/auth/login', { email: `inconnu-${unique()}@example.test`, password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  test('champs manquants ou non textuels → 400', async () => {
    expect((await post('/api/auth/login', { email: account.email })).status).toBe(400);
    expect((await post('/api/auth/login', { email: { $ne: '' }, password: PASSWORD })).status).toBe(400);
  });

  test('compte désactivé : 401 sans le bon mot de passe (rien n\'est révélé), 403 avec', async () => {
    const disabled = await register('Desactive');
    await query('UPDATE users SET is_active = false WHERE id = $1', [disabled.user.id]);
    expect((await post('/api/auth/login', { email: disabled.email, password: 'mauvais-mot-de-passe' })).status).toBe(401);
    expect((await post('/api/auth/login', { email: disabled.email, password: PASSWORD })).status).toBe(403);
    // Son ancien jeton ne fonctionne plus
    expect((await as(disabled).get('/api/auth/me')).status).toBe(401);
  });
});

describe('Jeton (JWT)', () => {
  let account;
  beforeAll(async () => { account = await register('Jeton'); });

  test('/me avec un jeton valide → l\'utilisateur, sans empreinte', async () => {
    const res = await as(account).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(account.user.id);
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test('sans jeton, jeton falsifié, autre secret ou « alg: none » → 401', async () => {
    const me = (token) => request(app).get('/api/auth/me').set(token ? { Authorization: `Bearer ${token}` } : {});
    expect((await me(null)).status).toBe(401);
    expect((await me(`${account.token}x`)).status).toBe(401);
    const otherSecret = jwt.sign({ id: account.user.id, role: 'admin' }, 'un-autre-secret-que-celui-du-serveur-0000');
    expect((await me(otherSecret)).status).toBe(401);
    const none = jwt.sign({ id: account.user.id, role: 'admin' }, null, { algorithm: 'none' });
    expect((await me(none)).status).toBe(401);
    const expired = jwt.sign({ id: account.user.id }, process.env.JWT_SECRET, { expiresIn: -10 });
    expect((await me(expired)).status).toBe(401);
  });
});

describe('En-têtes, CORS et erreurs', () => {
  test('en-têtes de sécurité présents, X-Powered-By absent', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('CORS : origine autorisée renvoyée, autre origine ignorée', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await request(app).get('/api/health').set('Origin', 'https://site-malveillant.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await request(app).options('/api/projects').set('Origin', 'https://site-malveillant.example');
    expect(preflight.status).toBe(403);
  });

  test('JSON mal formé → 400 clair, sans trace d\'exécution', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Corps de requête JSON invalide' });
  });

  test('/api/health n\'expose aucun secret', async () => {
    const res = await request(app).get('/api/health');
    expect(JSON.stringify(res.body)).not.toContain(process.env.GEMINI_API_KEY);
    expect(JSON.stringify(res.body)).not.toContain(process.env.JWT_SECRET);
  });
});

describe('Limitation de débit', () => {
  test('au-delà de la limite → 429 avec un message en français', async () => {
    // Petite application dédiée : la limite de l'application principale est relevée pour les tests
    const mini = express();
    mini.use(createAuthLimiter({ max: 2, windowMinutes: 1 }));
    mini.post('/login', (req, res) => res.status(401).json({ message: 'non' }));
    expect((await request(mini).post('/login')).status).toBe(401);
    expect((await request(mini).post('/login')).status).toBe(401);
    const blocked = await request(mini).post('/login');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/Trop de tentatives/);
  });
});
