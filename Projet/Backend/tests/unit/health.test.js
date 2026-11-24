import { describe, test, expect, afterEach } from '@jest/globals';
import request from 'supertest';

// GET /api/health (bloc 12) : état des services, sans jamais renvoyer de secret.
// app.js lit process.env à chaque requête : on peut changer les variables entre deux tests.
const { default: app } = await import('../../app.js');

const saved = { GEMINI_API_KEY: process.env.GEMINI_API_KEY, SMTP_HOST: process.env.SMTP_HOST, MAILBOX_URL: process.env.MAILBOX_URL };

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('GET /api/health', () => {
  test('indique l\'IA active et le SMTP configuré, sans exposer les valeurs', async () => {
    process.env.GEMINI_API_KEY = 'AIza-cle-secrete-de-test';
    process.env.SMTP_HOST = 'smtp.exemple.com';

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', services: { ai: true, email: 'smtp', mailbox: null }, limits: { audioMb: 200 } });
    expect(JSON.stringify(res.body)).not.toContain('AIza');
    expect(JSON.stringify(res.body)).not.toContain('smtp.exemple.com');
  });

  test('sans clé ni SMTP : IA non configurée et courriels en mode console', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.SMTP_HOST;

    const res = await request(app).get('/api/health');

    expect(res.body.services).toEqual({ ai: false, email: 'console', mailbox: null });
  });

  test('boîte courriel de test (Mailpit) : son adresse est renvoyée pour le lien de l\'en-tête', async () => {
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.MAILBOX_URL = 'http://localhost:8025';

    const res = await request(app).get('/api/health');

    expect(res.body.services).toMatchObject({ email: 'smtp', mailbox: 'http://localhost:8025' });
  });
});
