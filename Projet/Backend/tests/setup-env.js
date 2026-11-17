// tests/setup-env.js — Bloc 17
// Valeurs par défaut des tests UNITAIRES : ils fonctionnent sur un clone neuf, sans fichier
// .env.test. Les tests unitaires simulent la base et l'IA : aucune connexion réelle.
process.env.JWT_SECRET ||= 'secret-des-tests-unitaires-assez-long-pour-hs256';
process.env.JWT_EXPIRES_IN ||= '1h';
