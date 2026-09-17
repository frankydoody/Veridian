# Veridian — Contexte pour Claude Code

## Projet
Application web de mémoire organisationnelle pour réunions d'équipe.
Cours INF4018 — Maîtrise génie logiciel — TÉLUQ — Francis Côté

## Stack
- Backend : Node.js 20 + Express 5 + ES Modules ("type": "module")
- Base de données : PostgreSQL 16 + pgvector (Docker)
- IA transcription : Whisper local (Python, CPU mode, modèle small)
- IA analyse : Google Gemini 1.5 Flash (gratuit)
- Auth : JWT + bcryptjs
- Tests : Jest + dotenv-cli

## Conventions OBLIGATOIRES

### Imports
Toujours ES Modules : `import x from 'y'` — jamais `require()`

### Modèles (xxx.model.js)
- Import : `import { query, withTransaction } from '../config/db.js'`
- Fonctions PRIVÉES (sans export) → reçoivent `client` en premier paramètre, font UNE seule requête SQL
- Fonctions PUBLIQUES (avec export) → orchestrent avec withTransaction si plusieurs requêtes
- Jamais de DELETE SQL — soft delete uniquement (is_active = false)
- Toujours lister les colonnes explicitement dans SELECT (jamais SELECT *)
- Toujours filtrer par userId pour la sécurité

### Contrôleurs (xxx.controller.js)
- Signature : `async (req, res, next)`
- Jamais de SQL direct — toujours appeler le modèle
- Valider les données en entrée avant tout appel BD
- Vérifier les droits (req.user.id vs owner_id)
- Toujours `next(error)` dans le catch
- Nommer les handlers : `createXxxHandler`, `getXxxHandler`, etc.

### Routes (xxx.routes.js)
- Toujours `router.use(authMiddleware)` en premier
- Routes spécifiques avant routes génériques (/:id en dernier)

### app.js
- Toujours ajouter les nouvelles routes ici
- Ordre : middlewares globaux → routes → errorMiddleware (en dernier)

## Structure des dossiers
```
Projet/Backend/
├── src/
│   ├── config/        # db.js, gemini.js
│   ├── controllers/   # xxx.controller.js
│   ├── services/      # ia.service.js, whisper.service.js
│   ├── routes/        # xxx.routes.js
│   ├── middlewares/   # auth, upload, error
│   ├── models/        # xxx.model.js
│   └── utils/         # hash.utils.js, jwt.utils.js
├── database/
│   ├── schema.sql
│   └── migrations/
├── tests/
│   ├── unit/
│   └── integration/
├── app.js
└── server.js
```

## Données de test
- User : francis@test.com / 123456
- USER_ID : da3f9796-cd5e-45a9-a65a-92640c32e579
- PROJECT_ID : 49f8f14a-c7aa-4bc0-b327-f44818676fcd
- MEETING_ID : 16b165bd-bd98-43cc-898c-0f821f8bdda3

## Blocs complétés
- ✅ Bloc 01 : Infrastructure Docker + PostgreSQL + pgvector
- ✅ Bloc 02 : Authentification JWT
- ✅ Bloc 03 : Module Projets CRUD + transactions atomiques
- ✅ Bloc 04 : Module Réunions CRUD
- ✅ Bloc 05 : Transcription Audio Whisper (CPU mode)

## Bloc en cours
- 🔵 Bloc 06 : Extraction décisions Gemini
  - ✅ ia.service.js (extractDecisions, detectContradiction, chatWithMemory)
  - 🔵 decision.model.js — EN COURS
  - ⬜ decision.controller.js
  - ⬜ decision.routes.js
  - ⬜ Intégration post-transcription

## Commandes de démarrage
```bash
# Terminal 1 — Base de données
cd ~/dev/Veridian && docker compose up -d

# Terminal 2 — Backend
cd ~/dev/Veridian/Projet/Backend && npm run dev

# Token de test
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"francis@test.com","password":"123456"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
```

## Règles importantes
1. MODE APPRENTISSAGE — expliquer chaque concept et chaque ligne de code
2. Pas de fichiers complets sauf si explicitement demandé
3. Une étape à la fois, fonction par fonction
4. Toujours compiler/tester après chaque étape
5. Commits fréquents avec Conventional Commits (feat:, fix:, docs:, chore:)
6. Une branche par bloc, Pull Request obligatoire avant merge
7. Branches conservées après merge