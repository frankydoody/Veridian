// tests/api/setup-env.js — Bloc 17
// Exécuté AVANT chaque fichier de tests d'API, avant tout import de l'application.
// Les valeurs posées ici gagnent sur le fichier .env : dotenv ne remplace jamais une variable
// déjà définie.
//
// Garde-fous : on travaille UNIQUEMENT sur la base de test (nom en « _test »), aucun courriel
// réel ne part (SMTP vide = mode console) et aucune vraie clé Gemini n'est utilisée (l'IA est
// simulée dans les tests ; la clé factice ne permettrait de toute façon aucun appel).
process.env.DB_NAME = process.env.TEST_DB_NAME || 'veridian_test';
if (!/_test$/.test(process.env.DB_NAME)) {
  throw new Error(`Tests d'API refusés sur la base « ${process.env.DB_NAME} » : son nom doit se terminer par « _test ».`);
}

process.env.JWT_SECRET = 'secret-des-tests-api-assez-long-pour-hs256-0123456789';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SMTP_HOST = '';
process.env.GEMINI_API_KEY = 'cle-factice-des-tests';
process.env.FRONTEND_URL = 'http://localhost:5173';
// Les tests créent beaucoup de comptes depuis la même adresse : limite haute, sauf test dédié
process.env.AUTH_RATE_LIMIT = '10000';
