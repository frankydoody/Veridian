// database/preparer-base-test.mjs
// Bloc 17 — Crée la base de TEST (par défaut « veridian_test ») : base neuve, schéma, puis
// toutes les migrations dans l'ordre, enregistrées dans schema_migrations (comme les scripts
// de démarrage).
//
// Sécurité : le script refuse toute base dont le nom ne se termine pas par « _test ».
// Il ne peut donc JAMAIS effacer la base de développement « veridian ».
//
// Lancer (depuis Projet/Backend) :  npm run test:db
// Appelé aussi automatiquement avant les tests d'API (tests/api/global-setup.js).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

export const TEST_DB_NAME = process.env.TEST_DB_NAME || 'veridian_test';

export const assertTestDatabaseName = (name) => {
  if (!/^[a-z0-9_]+_test$/.test(name)) {
    throw new Error(`Base de test refusée : « ${name} ». Son nom doit se terminer par « _test » (ex. veridian_test).`);
  }
};

const connection = (database) => ({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database,
});

/**
 * Supprime puis recrée la base de test, et applique schéma + migrations.
 * @returns {{ database: string, migrations: string[] }}
 */
export async function prepareTestDatabase(name = TEST_DB_NAME) {
  assertTestDatabaseName(name);

  // 1. Base neuve. WITH (FORCE) ferme les connexions restées ouvertes (PostgreSQL 13+).
  const admin = new pg.Client(connection('postgres'));
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  // 2. Schéma puis migrations, dans l'ordre des noms de fichiers
  const db = new pg.Client(connection(name));
  await db.connect();
  const applied = [];
  try {
    await db.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
    await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const dir = path.join(here, 'migrations');
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      await db.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      applied.push(file);
    }
  } finally {
    await db.end();
  }
  return { database: name, migrations: applied };
}

// Lancé directement : node database/preparer-base-test.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareTestDatabase()
    .then(({ database, migrations }) => {
      console.log(`✅ Base de test « ${database} » prête : schéma + ${migrations.length} migrations (${migrations.at(-1)}).`);
    })
    .catch((error) => {
      console.error(`❌ Préparation de la base de test impossible : ${error.message}`);
      if (error.code === 'ECONNREFUSED') console.error('   La base PostgreSQL est-elle démarrée ? (docker compose up -d)');
      process.exitCode = 1;
    });
}
