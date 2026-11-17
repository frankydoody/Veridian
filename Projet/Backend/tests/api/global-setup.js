// tests/api/global-setup.js — Bloc 17
// Une seule fois avant les tests d'API : base de test NEUVE (schéma + toutes les migrations).
// Chaque exécution part donc du même état, et la base de développement n'est jamais touchée.
import { prepareTestDatabase } from '../../database/preparer-base-test.mjs';

export default async function globalSetup() {
  const { database, migrations } = await prepareTestDatabase();
  console.log(`\nBase de test « ${database} » recréée (${migrations.length} migrations).`);
}
