import { describe, test, expect, jest } from '@jest/globals';
import {
  buildChecks, runChecks, formatReport, hasErrors, missingMigrations, startupNotices, STATUS,
} from '../../src/services/verification.service.js';

// Bloc 18 — vérification de l'installation : chaque dépendance est simulée.

const env = {
  DB_USER: 'u', DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'veridian',
  GEMINI_API_KEY: 'cle', AI_MODEL: 'gemini-3.5-flash', SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587', PORT: '3000',
};

const healthyDeps = (over = {}) => ({
  env,
  securityProblems: () => [],
  query: jest.fn(async (sql) => {
    if (sql.includes('pg_extension')) return { rows: [{ extversion: '0.8.0' }] };
    if (sql.includes('schema_migrations')) return { rows: [{ name: '001_a.sql' }, { name: '002_b.sql' }] };
    return { rows: [] };
  }),
  migrationFiles: () => ['001_a.sql', '002_b.sql'],
  generate: jest.fn(async () => 'OK'),
  embed: jest.fn(async () => new Array(768).fill(0)),
  embedDimensions: 768,
  commandWorks: jest.fn(async () => true),
  smtpVerify: jest.fn(async () => {}),
  portBusy: jest.fn(async () => false),
  fetchText: jest.fn(async () => null),
  ...over,
});

const run = async (deps, options) => {
  const results = await runChecks(buildChecks(deps, options));
  return Object.fromEntries(results.map((r) => [r.name, r]));
};

describe('missingMigrations', () => {
  test('liste triée des fichiers .sql non appliqués', () => {
    expect(missingMigrations(['003_c.sql', '001_a.sql', 'lisezmoi.txt', '002_b.sql'], ['001_a.sql']))
      .toEqual(['002_b.sql', '003_c.sql']);
  });
});

describe('Installation saine', () => {
  test('tout est OK, sauf rien', async () => {
    const r = await run(healthyDeps());
    expect(Object.values(r).every((c) => c.status === STATUS.OK)).toBe(true);
    expect(r['Migrations'].detail).toMatch(/2 appliquées.*002_b\.sql/);
    expect(r['Port 3000 (backend)'].detail).toBe('libre');
  });
});

describe('Problèmes détectés', () => {
  test('base injoignable : erreur actionnable, contrôles SQL suivants ignorés', async () => {
    const deps = healthyDeps({ query: jest.fn(async () => { throw Object.assign(new Error('x'), { code: 'ECONNREFUSED' }); }) });
    const r = await run(deps);
    expect(r['Base de données']).toMatchObject({ status: STATUS.ERROR });
    expect(r['Base de données'].detail).toMatch(/ECONNREFUSED.*docker compose up -d/);
    expect(r['Extension vector (pgvector)'].status).toBe(STATUS.SKIP);
    expect(r['Migrations'].status).toBe(STATUS.SKIP);
  });

  test('extension vector absente et migration manquante', async () => {
    const deps = healthyDeps({
      query: jest.fn(async (sql) => (sql.includes('schema_migrations')
        ? { rows: [{ name: '001_a.sql' }] } : { rows: [] })),
    });
    const r = await run(deps);
    expect(r['Extension vector (pgvector)'].status).toBe(STATUS.ERROR);
    expect(r['Migrations'].detail).toMatch(/1 non appliquée\(s\) : 002_b\.sql/);
  });

  test('clé Gemini vide : erreur, sans appel à Google', async () => {
    const deps = healthyDeps({ env: { ...env, GEMINI_API_KEY: '' } });
    const r = await run(deps);
    expect(r['Clé Gemini (analyse)'].status).toBe(STATUS.ERROR);
    expect(r['Gemini (mémoire, embeddings)'].status).toBe(STATUS.SKIP);
    expect(deps.generate).not.toHaveBeenCalled();
  });

  test('clé refusée : le message clair de gemini.js est repris', async () => {
    const deps = healthyDeps({ generate: jest.fn(async () => { throw new Error('Clé Gemini refusée par Google : vérifiez GEMINI_API_KEY'); }) });
    const r = await run(deps);
    expect(r['Clé Gemini (analyse)'].detail).toMatch(/^Clé Gemini refusée/);
  });

  test('--sans-ia et --sans-whisper : aucun appel', async () => {
    const deps = healthyDeps();
    const r = await run(deps, { skipAi: true, skipWhisper: true });
    expect(deps.generate).not.toHaveBeenCalled();
    expect(deps.commandWorks).not.toHaveBeenCalled();
    expect(r['Whisper (transcription)'].status).toBe(STATUS.SKIP);
  });

  test('Whisper et ffmpeg : chemins de .env utilisés, erreur si introuvables', async () => {
    const deps = healthyDeps({
      env: { ...env, WHISPER_COMMAND: 'C:\\w\\whisper.exe' },
      commandWorks: jest.fn(async () => false),
    });
    const r = await run(deps);
    expect(deps.commandWorks).toHaveBeenCalledWith('C:\\w\\whisper.exe', ['--help']);
    expect(deps.commandWorks).toHaveBeenCalledWith('ffmpeg', ['-version']);
    expect(r['ffmpeg'].status).toBe(STATUS.ERROR);
    expect(r['Whisper (transcription)'].detail).toMatch(/WHISPER_COMMAND/);
  });

  test('SMTP absent : simple avertissement (mode console)', async () => {
    const r = await run(healthyDeps({ env: { ...env, SMTP_HOST: '' } }));
    expect(r['Courriels (SMTP)']).toMatchObject({ status: STATUS.WARN });
    expect(r['Courriels (SMTP)'].detail).toMatch(/simulés/);
  });

  test('SMTP : identifiants refusés → conseil du mot de passe d\'application', async () => {
    const deps = healthyDeps({ smtpVerify: jest.fn(async () => { throw Object.assign(new Error('Invalid login: 535'), { code: 'EAUTH' }); }) });
    const r = await run(deps);
    expect(r['Courriels (SMTP)'].detail).toMatch(/mot de passe d'application/);
  });

  test('SMTP : serveur injoignable', async () => {
    const deps = healthyDeps({ smtpVerify: jest.fn(async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); }) });
    const r = await run(deps);
    expect(r['Courriels (SMTP)'].detail).toMatch(/injoignable \(ETIMEDOUT\)/);
  });

  test('ports : Veridian déjà démarré = OK, autre programme = erreur', async () => {
    const deps = healthyDeps({
      portBusy: jest.fn(async () => true),
      fetchText: jest.fn(async (url) => (url.includes('/api/health') ? '{"status":"ok"}' : '<html>autre</html>')),
    });
    const r = await run(deps);
    expect(r['Port 3000 (backend)'].detail).toMatch(/déjà utilisé par Veridian/);
    expect(r['Port 5173 (frontend)'].status).toBe(STATUS.ERROR);
  });

  test('.env absent ou secret faible : erreur', async () => {
    const r = await run(healthyDeps({ securityProblems: () => ['JWT_SECRET est vide'] }));
    expect(r['Fichier .env']).toMatchObject({ status: STATUS.ERROR, detail: 'JWT_SECRET est vide' });
  });
});

describe('Rapport', () => {
  test('exception inattendue → erreur, les contrôles suivants continuent', async () => {
    const results = await runChecks([
      { name: 'A', run: async () => { throw new Error('boum'); } },
      { name: 'B', run: async () => ({ status: STATUS.OK, detail: 'ok' }) },
    ]);
    expect(results).toEqual([
      { name: 'A', status: STATUS.ERROR, detail: 'boum' },
      { name: 'B', status: STATUS.OK, detail: 'ok' },
    ]);
    expect(hasErrors(results)).toBe(true);
  });

  test('bilan : erreurs et avertissements comptés', () => {
    const text = formatReport([
      { name: 'A', status: STATUS.ERROR, detail: 'x' },
      { name: 'B', status: STATUS.WARN, detail: 'y' },
    ]);
    expect(text).toMatch(/\[ERREUR\]\s+A : x/);
    expect(text).toMatch(/1 problème\(s\) à corriger, 1 avertissement\(s\)\./);
    expect(formatReport([{ name: 'A', status: STATUS.OK, detail: 'ok' }])).toMatch(/Tout est prêt\./);
  });

  test('aucun secret dans le rapport', async () => {
    const secretEnv = { ...env, GEMINI_API_KEY: 'AIzaSECRET', SMTP_PASSWORD: 'motdepasse', DB_PASSWORD: 'pw', JWT_SECRET: 'jwt' };
    const results = await runChecks(buildChecks(healthyDeps({ env: secretEnv })));
    expect(formatReport(results)).not.toMatch(/AIzaSECRET|motdepasse|\bpw\b|\bjwt\b/);
  });
});

describe('startupNotices', () => {
  test('SMTP absent et clé vide : les deux modes dégradés sont annoncés', () => {
    const notices = startupNotices({});
    expect(notices[0]).toMatch(/SMTP non configuré : courriels simulés/);
    expect(notices[1]).toMatch(/GEMINI_API_KEY vide/);
  });

  test('configuration complète : serveur SMTP indiqué, sans mot de passe', () => {
    const notices = startupNotices({ SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587', SMTP_PASSWORD: 'secret', GEMINI_API_KEY: 'k' });
    expect(notices).toEqual(['📧 Courriels : envoi réel par smtp.gmail.com:587']);
  });
});
