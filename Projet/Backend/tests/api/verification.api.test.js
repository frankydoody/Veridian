import { describe, test, expect, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import pool from '../../src/config/db.js';
import { buildChecks, runChecks, STATUS } from '../../src/services/verification.service.js';

// Bloc 18 — contrôles SQL de la vérification sur une VRAIE base (veridian_test) :
// les requêtes sur pg_extension et schema_migrations doivent être valides.

const migrationsDir = path.resolve('database', 'migrations');
const migrationFiles = () => fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

const deps = {
  env: process.env,
  securityProblems: () => [],
  query: (sql) => pool.query(sql),
  migrationFiles,
  embedDimensions: 768,
};

const dbChecks = () => buildChecks(deps, { skipAi: true, skipWhisper: true })
  .filter((c) => ['Base de données', 'Extension vector (pgvector)', 'Migrations'].includes(c.name));

afterAll(async () => {
  await pool.query('DELETE FROM schema_migrations WHERE name = $1', ['999_fictive.sql']).catch(() => {});
});

describe('Vérification sur la base de test', () => {
  test('base joignable, vector présent, toutes les migrations appliquées', async () => {
    const results = await runChecks(dbChecks());
    expect(results.map((r) => r.status)).toEqual([STATUS.OK, STATUS.OK, STATUS.OK]);
    expect(results[2].detail).toContain(`${migrationFiles().length} appliquées`);
  });

  test('une migration présente sur disque mais non appliquée est signalée', async () => {
    deps.migrationFiles = () => [...migrationFiles(), '999_fictive.sql'];
    const results = await runChecks(dbChecks());
    deps.migrationFiles = migrationFiles;
    expect(results[2]).toMatchObject({ status: STATUS.ERROR });
    expect(results[2].detail).toMatch(/1 non appliquée\(s\) : 999_fictive\.sql/);
  });
});
