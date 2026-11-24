# Veridian

Application web de mémoire organisationnelle alimentée par l'IA — INF1430, Francis Côté

---

## Stack technologique

| Couche | Technologie |
|---|---|
| Backend | Node.js 20 / Express 5 |
| Base de données | PostgreSQL 16 + extension pgvector |
| Conteneurisation | Docker Compose |
| Auth | JWT + bcryptjs |
| Transcription | Whisper (local, modèle *small*) |
| LLM | Gemini 2.5 Flash (Google AI) |
| Frontend | React 19 / Vite / Tailwind CSS |
| Tests | Jest + dotenv-cli |

---

## Structure du dépôt

```
Veridian/
├── Demarrer.bat           # Double-clic : installe et démarre (Windows)
├── start.ps1              # Installateur / démarrage automatisé Windows
├── start.sh               # Démarrage automatisé Ubuntu
├── docker-compose.yml     # PostgreSQL 16 + pgvector
├── Projet/
│   ├── Backend/
│   │   ├── app.js         # Config Express
│   │   ├── server.js      # Point d'entrée HTTP
│   │   ├── package.json
│   │   ├── .env           # Variables (non versionné, à fournir)
│   │   ├── .env.example   # Modèle de .env sans secret
│   │   ├── database/
│   │   │   ├── schema.sql         # schéma de base (9 tables) — à appliquer AVANT les migrations
│   │   │   ├── seed.js            # données de test facultatives (3 comptes, 4 projets, réunions analysées...)
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── config/    # db.js, gemini.js
│   │       ├── controllers/
│   │       ├── middlewares/
│   │       ├── models/
│   │       ├── routes/
│   │       ├── services/  # whisper, ia, RAG
│   │       └── utils/     # jwt, hash
│   └── Frontend/
│       ├── index.html
│       ├── package.json
│       └── src/
│           ├── api/       # client.js
│           ├── contexts/  # AuthContext
│           ├── components/
│           ├── pages/
│           └── utils/
└── Documentations/
    ├── TN1_MiseEnPlace.tex
    ├── TN2_RapportMiParcours.tex
    └── references.bib
```

---

## Installation et démarrage

### En bref (Windows)

1. **Obtenir le projet** : `git clone https://github.com/frankydoody/Veridian.git` (ou `git pull` si déjà cloné).
2. **Placer le fichier `.env`** dans `Projet\Backend\` (voir [Le fichier .env](#le-fichier-env)).
3. **Double-cliquer sur `Demarrer.bat`** à la racine du projet.

Tout le reste est automatique : installation de ce qui manque, base de données, migrations, démarrage des deux serveurs et ouverture du navigateur. Quand c'est prêt, l'application est sur **http://localhost:5173**.

> **Seul prérequis : Windows 10/11 à jour avec `winget`** (déjà inclus dans Windows 11 et dans Windows 10 à jour) **et une connexion Internet.** Aucun autre logiciel n'a besoin d'être installé avant.

### Quoi, où, comment

| Quoi | Où | Comment |
|---|---|---|
| Le code du projet | dossier de ton choix, p. ex. `C:\Dev\Veridian` | `git clone` ou `git pull` |
| Le fichier de configuration `.env` | `Projet\Backend\.env` (nom exact, sans extension) | fourni, ou créé selon la section ci-dessous |
| Le démarrage | racine du projet, `Demarrer.bat` | double-clic (équivaut à `powershell -ExecutionPolicy Bypass -File .\start.ps1`) |
| L'application | http://localhost:5173 | s'ouvre toute seule |

### Le fichier .env

Le `.env` contient les réglages et les clés secrètes. Il n'est **jamais versionné** (absent de GitHub) : il faut donc le fournir à chaque nouvelle machine. Le modèle sans secret est `Projet/Backend/.env.example`.

**Option A — tu as reçu un `.env`**

1. Copier le fichier reçu dans `Projet\Backend\`.
2. Vérifier que son nom est exactement `.env` : Windows cache souvent les extensions et un téléchargement peut devenir `.env.txt`. Dans l'Explorateur : *Affichage → Afficher → Extensions de noms de fichiers*, puis renommer au besoin.
3. Lancer `Demarrer.bat`. Le script ne modifie jamais la clé Gemini ni le secret JWT d'un `.env` existant ; il ne corrige que les valeurs de base de données et le port, qui doivent correspondre à Docker.

**Option B — tu n'as pas de `.env` et tu le crées toi-même**

1. Obtenir une clé Gemini gratuite : aller sur <https://aistudio.google.com/app/apikey>, se connecter avec un compte Google, *Create API key*, copier la clé (elle commence par `AIza`).
2. Lancer `Demarrer.bat`. Si `Projet\Backend\.env` n'existe pas, le script le crée avec les valeurs par défaut, génère le `JWT_SECRET` et **demande la clé Gemini** dans la fenêtre : coller la clé, Entrée.

   *Ou le faire à la main* : copier `Projet\Backend\.env.example` en `Projet\Backend\.env`, puis remplir :
   - `GEMINI_API_KEY=` → la clé copiée à l'étape 1 ;
   - `JWT_SECRET=` → laisser vide (le script en génère un), ou générer une valeur dans PowerShell :

     ```powershell
     $b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)
     ```
3. Sans clé Gemini, l'application démarre mais les fonctions d'IA (extraction des décisions, mémoire, chat) ne fonctionnent pas. Il suffit d'ajouter la clé plus tard dans `.env`, puis de relancer `Demarrer.bat`.

Toutes les variables sont décrites dans [Variables d'environnement](#variables-denvironnement).

### Ce que fait Demarrer.bat

Le script (`start.ps1`) est un installateur : chaque étape vérifie d'abord son état et ne fait que le travail manquant. Il peut être relancé autant de fois que nécessaire.

| Étape | Action |
|---|---|
| 1 | Met à jour la liste des paquets winget |
| 2 | Lit `.env` (le crée et le complète si besoin) |
| 3 | Vérifie la **virtualisation** (BIOS/UEFI) et **WSL 2** ; active la *Plateforme de machine virtuelle* et WSL au besoin (confirmation administrateur Windows demandée) |
| 4 | Installe **Node.js LTS**, **Docker Desktop**, **Python 3.12**, **ffmpeg** et **Whisper** (avec son modèle) — seulement ceux qui manquent |
| 5 | `npm install` du backend et du frontend (premier clone ou après un `git pull`) |
| 6 | Démarre Docker Desktop, puis **PostgreSQL 16 + pgvector** (`docker compose`) |
| 7 | Crée le schéma (`schema.sql`) puis applique les **migrations** non encore appliquées (suivies dans la table `schema_migrations`), puis ajoute les **données de démonstration** si la base n'a aucun utilisateur |
| 8 | Ouvre deux fenêtres, **Veridian - Backend** et **Veridian - Frontend**, qui exécutent chacune `npm run dev`, puis ouvre le navigateur |

À savoir :

- **Premier lancement sur un PC vierge : prévoir 15 à 30 minutes.** Docker Desktop, l'image PostgreSQL, Whisper (plusieurs Go) et son modèle sont téléchargés une seule fois.
- Windows affiche des demandes d'autorisation (UAC) pendant les installations : accepter.
- **Redémarrage** : l'activation de la virtualisation / WSL 2 et la première installation de Docker Desktop demandent souvent un redémarrage de Windows. Le script le propose, puis **se relance tout seul** à l'ouverture de session suivante. Si ça ne se produit pas, double-cliquer à nouveau sur `Demarrer.bat`.
- Les lancements suivants prennent quelques secondes : le script ne fait que démarrer.
- Garder les deux fenêtres « Backend » et « Frontend » ouvertes tant qu'on utilise l'application.

Options (ligne de commande) : `-SkipWhisper` (ne pas installer la transcription audio locale), `-InstallOnly` (tout installer et préparer, sans lancer les serveurs) et `-NoSeed` (ne pas ajouter les données de démonstration) :

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -InstallOnly
```

### Vérifier que tout fonctionne

| Service | Adresse |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |
| Health check | http://localhost:3000/api/health |

Se connecter avec un compte de test (voir « Données de test » ci-dessous), ou créer son propre compte sur la page d'inscription.

### Données de test (facultatif)

Un jeu de **données de test** (comptes et projets fictifs) permet d'essayer l'application ou de la présenter sans tout saisir. Il imite exactement le résultat de la vraie chaîne d'analyse : réunions transcrites et analysées, tâches liées à leurs acteurs avec des échéances, alertes, risques, journal des courriels. Pour l'instant, les scripts de démarrage l'ajoutent sur une base vide (désactivable avec `-NoSeed`, ou `NO_SEED=1` sous Ubuntu). Le bloc 18 le rendra entièrement facultatif. **Mot de passe de tous les comptes : `12345678`**

| Compte | Rôle | Projets accessibles |
|---|---|---|
| `admin@example.com` | admin | Refonte du site web client, Application mobile Atlas, Boutique en ligne |
| `marie.tremblay@example.com` | membre | Refonte du site web client, Application mobile Atlas |
| `samuel.gagnon@example.com` | membre | Refonte du site web client, Boutique en ligne, Plan de relève RH (confidentiel) |

Contenu : 4 projets, 8 réunions (7 transcrites et analysées, 1 planifiée sans audio pour essayer l'enregistrement), 17 décisions (confirmées, provisoires, contredites), 2 alertes de contradiction, 4 risques, 16 tâches (à faire, en cours, terminées, en retard, dates estimées) et 19 courriels journalisés.

Scénarios de test utiles :
- **Une chaîne complète en 3 réunions** (« Application mobile Atlas ») :
  - **création** : périmètre, React Native, mode hors ligne ;
  - **contradiction** : les notifications push, reportées à la version 2, sont finalement demandées dès la première version → alerte ;
  - **mise à jour** : prototype livré, tâches terminées, nouvelles tâches, risques.
- **Projet créé par une réunion** : l'analyse du « Suivi technique » (Refonte) a créé « Boutique en ligne ». La page de la réunion l'affiche « Nouveau » ; Samuel, qui y reçoit une tâche, en est devenu membre.
- **Contradictions** : dans « Refonte du site web client », l'hébergement chez Cloudflare Pages (lancement) est contredit par la migration vers un serveur interne (suivi technique).
- **Mes tâches, tableau de bord, calendrier** : chaque compte a ses tâches, dont une en retard (Admin). La « Revue de sprint » est planifiée dans 3 jours et apparaît dans le calendrier.
- **Isolation des données** : « Plan de relève RH (confidentiel) » n'appartient qu'à Samuel ; `admin@example.com` et Marie ne doivent ni le voir ni y accéder (réponse 404).
- **Mémoire / chat** : les transcriptions et décisions sont indexées à l'ajout des données si la clé Gemini est valide. Sinon, on relance l'indexation d'une réunion avec `POST /api/memory/index/:meetingId`.
- **Export PDF** : bouton « Exporter en PDF » de la page Décisions ; les non-membres reçoivent 404.

Commandes (depuis `Projet/Backend`) :

```bash
node database/seed.js                  # ajoute les données de test si elles n'existent pas (sinon ne fait rien)
node database/seed.js --no-embeddings  # idem, sans appeler Gemini
```

Partir d'une base entièrement vide : `docker compose down -v`, puis relancer `Demarrer.bat`. Ne pas ajouter les données de démonstration : `powershell -ExecutionPolicy Bypass -File .\start.ps1 -NoSeed` (Ubuntu : `NO_SEED=1 ./start.sh`).

### Mettre à jour le projet

```powershell
git pull
```

Puis relancer `Demarrer.bat` : les nouvelles dépendances et les nouvelles migrations sont appliquées automatiquement.

### Arrêt

Fermer les deux fenêtres (ou Ctrl+C dans chacune), puis, pour arrêter la base :

```powershell
docker compose down       # arrête PostgreSQL, conserve les données
docker compose down -v    # arrête et efface les données
```

---

## Installation sur Ubuntu

```bash
sudo apt install -y git curl ffmpeg python3-pip
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc && nvm install 20 && nvm use 20 && nvm alias default 20
pip3 install openai-whisper --break-system-packages
```

Docker (une seule fois) :

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker
```

Puis placer le `.env` dans `Projet/Backend/` (même procédure que ci-dessus) et lancer :

```bash
chmod +x start.sh   # une seule fois
./start.sh
```

`start.sh` vérifie les prérequis, démarre la base, applique le schéma puis les migrations, installe les dépendances npm et ouvre les terminaux **Veridian - Backend** et **Veridian - Frontend**.

### Démarrage manuel (toutes plateformes)

```bash
# Démarrer la DB
docker compose up -d
docker compose ps   # attendre: healthy

# Initialiser la base (première fois seulement) : le schéma d'abord, PUIS les migrations, dans l'ordre
# Ubuntu / macOS
for f in Projet/Backend/database/schema.sql Projet/Backend/database/migrations/*.sql; do
  docker exec -i veridian_db psql -v ON_ERROR_STOP=1 -U veridian_user -d veridian < "$f" || break
done
# Windows (PowerShell) : copier chaque fichier dans le conteneur, puis l'exécuter avec -f
#   docker cp Projet\Backend\database\schema.sql veridian_db:/tmp/schema.sql
#   docker exec veridian_db psql -v ON_ERROR_STOP=1 -U veridian_user -d veridian -f /tmp/schema.sql
#   (répéter pour chaque fichier de Projet\Backend\database\migrations\, dans l'ordre : 001, 003, 007)

# Backend
cd Projet/Backend && npm install && npm run dev

# Frontend (autre terminal)
cd Projet/Frontend && npm install && npm run dev
```

> ⚠️ PowerShell ne supporte pas `<` pour `docker exec` : utiliser `docker cp` puis `psql -f`, comme ci-dessus.

---

## Plan de développement — 18 blocs

Chaque bloc = une branche Git `bloc-XX`, une PR vers `main`, jamais supprimée.

### Backend

| Bloc | Titre | Statut | Description |
|---|---|---|---|
| 01 | Infrastructure et Configuration | ✅ Done | Dépôt, Docker, schéma SQL, scripts de démarrage |
| 02 | Authentification JWT | ✅ Done | Inscription, connexion, `authMiddleware`, token JWT |
| 03 | Gestion des Projets CRUD | ✅ Done | Endpoints `/api/projects`, soft delete |
| 04 | Gestion des Réunions CRUD | ✅ Done | Endpoints réunions, upload Multer, audio persisté |
| 05 | Transcription Audio (Whisper) | ✅ Done | Pipeline Whisper local, transcription en base |
| 06 | Extraction des décisions (Gemini) | ✅ Done | Appel Gemini 1.5 Flash, décisions extraites |
| 07 | Mémoire vectorielle (RAG) | ✅ Done | Embeddings pgvector, recherche sémantique |
| 08 | Détection contradictions & Alertes | ✅ Done | Comparaison des nouvelles décisions aux décisions passées du projet, alertes persistées, routes `/api/alerts` |
| 09 | Chat mémoire & Export PDF | ✅ Done | Conversations avec historique par utilisateur et par projet (`/api/chat`), export PDF d'un projet (`GET /api/projects/:id/export/pdf`) |

### Frontend

| Bloc | Titre | Statut | Description |
|---|---|---|---|
| 10 | Frontend Auth | ✅ Done | Pages connexion/inscription, token JWT côté client |
| 11 | Frontend Dashboard | ✅ Done | Pages Projets, Réunions, Tâches, Mémoire (statique) |
| 12 | Frontend API Connect | ✅ Done | Toutes les pages lisent l'API (états chargement / vide / erreur), session expirée (401) renvoyée vers la connexion avec un message, durées relatives passé/futur, statuts réels de la base, pastilles d'état réelles (clé Gemini, SMTP) |
| 13 | Frontend Formulaires | ✅ Done | Formulaires Créer un projet / une réunion / une tâche (et modification de tâche), validation client et serveur ; page d'un projet avec gestion des membres (`/api/projects/:id/members`) ; acteur d'une tâche choisi parmi les membres ; suppression logique des tâches (migration 011) |
| 14 | Frontend Réunion Détaillée | ✅ Done | Page `/meetings/:id` : lecteur audio (route protégée, `Range`), transcription modifiable (mémoire ré-indexée), décisions, tâches (acteur, échéance), contradictions, risques, courriels ; liens depuis les autres pages (`GET /api/meetings/:id/details`, `GET /api/meetings/:id/audio`) |
| 15 | Frontend Décisions & Contradictions | ✅ Done | Page `/decisions` : décisions du projet filtrables, alertes de contradiction à résoudre, bouton d'export PDF |
| 16 | Frontend Calendrier de projet | ✅ Done | Page `/calendar` : vue mensuelle (semaines du lundi au dimanche), mois précédent/suivant et « Aujourd'hui », réunions et échéances de tâches en couleur avec légende, filtre par projet et « Seulement mes tâches », liste du jour, navigation au clavier ; date prévue d'une réunion (migration 014) ; `GET /api/calendar?from&to&projectId` |

### Pipeline IA de bout en bout (extension du plan)

| Bloc | Titre | Statut | Description |
|---|---|---|---|
| 19 | Pipeline IA & courriels | ✅ Done (à tester) | Une réunion transcrite est analysée : projets détectés (existants réutilisés, nouveaux créés), décisions, tâches liées à un acteur avec date de fin estimée, contradictions, risques, courriel par acteur et résumé de l'organisateur (`POST /api/meetings/:id/analyze`, `GET /api/meetings/:id/analysis`, `POST /api/transcriptions/text`) |
| 20 | Frontend Enregistrement | ✅ Done | Enregistrement dans le navigateur (MediaRecorder : pause, niveau du micro, écoute de contrôle), téléversement d'un fichier, transcription collée ; envoi en `202` et Whisper en arrière-plan (`transcription_status`, migration 012), suivi en direct, erreurs claires (micro refusé, ffmpeg absent, fichier trop gros) |
| 21 | Frontend Réunion & Tâches liées | ✅ Done | Section Analyse de la réunion (état en direct, relance, projets nouveaux ou existants, courriels), tâches regroupées par acteur avec échéance estimée ; page « Mes tâches » (filtres, tri par échéance, retard, statut) ; tableau de bord aux compteurs réels (`GET /api/dashboard`, migration 013) |
| 22 | Jeu de données de scénario & tests d'intégration | ✅ Done | Données de test conformes au modèle actuel (tâches liées aux acteurs, réunions analysées, risques, courriels, projet créé par une réunion, réunion planifiée au calendrier) ; scénario en 3 réunions (création, contradiction, mise à jour) ; `seedTestData` testé sur `veridian_test` par les vraies routes (`tests/api/seed.api.test.js`) |

### Qualité et livraison

| Bloc | Titre | Statut | Description |
|---|---|---|---|
| 17 | Tests d'intégration & Qualité | ✅ Done | Tests d'API (Jest + supertest) sur une vraie base de test `veridian_test` recréée à chaque exécution : authentification, CRUD, contrôle d'accès (404 partout pour un non-membre), chaîne d'analyse avec IA simulée, mémoire vectorielle, chat, PDF ; couverture des lignes ≈ 92 % ; sécurité : `helmet`, CORS configurable (`FRONTEND_URL`), limitation de débit sur la connexion, mot de passe de 8 caractères minimum, courriel unique sans tenir compte de la casse (migration 015), JWT en HS256 imposé, refus de démarrer sans secret JWT solide |
| 18 | Déploiement & Documentation finale | Todo | Guide déploiement, variables documentées, TN4 |

---

## Architecture backend

### Schéma de base de données

11 tables. Préfixes : `core_` (partagé), `mtg_` (réunions).

| Table | Rôle |
|---|---|
| `core_users` | Utilisateurs, auth JWT |
| `core_projects` | Projets, soft delete (`is_active`) |
| `core_project_members` | Membres par projet |
| `mtg_meetings` | Réunions liées à un projet |
| `mtg_participants` | Participants à une réunion |
| `mtg_transcriptions` | Texte brut transcrit par Whisper |
| `mtg_decisions` | Décisions extraites par Gemini |
| `mtg_memory_chunks` | Vecteurs pgvector (mémoire RAG) |
| `mtg_alerts` | Alertes de contradiction |
| `mtg_chat_conversations` | Conversations du chat mémoire (une par utilisateur et par projet), soft delete |
| `mtg_chat_messages` | Questions et réponses du chat, avec les sources utilisées |

### Règles architecturales

- **Soft delete** — flag `is_active`, jamais de `DELETE` SQL applicatif
- **Transactions dans le modèle** — `withTransaction` dans `models/` seulement
- **Séparation des couches** — model : SQL ; controller : logique métier ; routes : HTTP
- **IA agnostique** — `ia.service.js`, configurable via `AI_PROVIDER` + `AI_MODEL`
- **dotenv v16 épinglé** — v17 casse la connexion PostgreSQL sur Windows

### Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/config/db.js` | Pool de connexions PostgreSQL |
| `src/config/gemini.js` | Configuration Gemini AI |
| `src/services/whisper.service.js` | Pipeline de transcription audio |
| `src/services/ia.service.js` | `extractDecisions`, `detectContradiction`, `chatWithMemory` |
| `src/services/contradiction.service.js` | Compare les nouvelles décisions aux décisions passées du projet et crée les alertes (bloc 08) |
| `src/models/alert.model.js` | Alertes : création avec marquage de la décision contredite (transaction), liste, résolution |
| `src/controllers/alert.controller.js` | `GET /api/alerts/project/:projectId[?status=open]`, `PATCH /api/alerts/:id/resolve` |
| `src/models/chat.model.js` | Conversations et messages du chat (filtrés par utilisateur), suppression douce, enregistrement question + réponse en une transaction (bloc 09) |
| `src/services/chat.service.js` | Chat avec historique : recherche dans le projet, réponse du LLM avec les derniers messages, sources enregistrées |
| `src/controllers/chat.controller.js` | `POST/GET /api/chat/conversations`, `GET/DELETE /api/chat/conversations/:id`, `POST /api/chat/conversations/:id/messages` |
| `src/services/pdf.service.js` | Génère le rapport PDF d'un projet (résumé, réunions, décisions, tâches, alertes) avec `pdfkit` |
| `src/controllers/export.controller.js` | `GET /api/projects/:id/export/pdf` (téléchargement du rapport) |
| `database/migrations/009_chat_conversations.sql` | Tables `mtg_chat_conversations` et `mtg_chat_messages` |
| `src/services/meeting-pipeline.service.js` | Orchestre l'analyse d'une réunion : IA → enregistrement → mémoire → contradictions → risques → courriels (bloc 19) |
| `src/utils/analysis.utils.js` | Fonctions pures : correspondance des noms (acteurs, projets), priorités, dates estimées, nettoyage de la réponse de l'IA |
| `src/models/pipeline.model.js` | Enregistrement atomique de l'analyse (projets, décisions, tâches), risques, journal des courriels |
| `src/services/notification.service.js` | Construction des courriels (un par acteur + résumé) et envoi SMTP ; sans `SMTP_HOST`, mode console |
| `src/controllers/analysis.controller.js` | `POST /api/meetings/:id/analyze[?wait=true&notify=false]`, `GET /api/meetings/:id/analysis` |
| `database/migrations/010_pipeline_reunion.sql` | `tasks.assignee_id`, état d'analyse des réunions, tables `mtg_risks` et `mtg_notifications` |
| `tests/integration/pipeline.it.mjs` | Scénario complet sur une vraie base avec une IA simulée (voir l'en-tête du fichier) |
| `src/models/member.model.js` | Membres d'un projet : liste, compte par courriel exact, ajout ou réactivation (`ON CONFLICT`), retrait logique (bloc 13) |
| `src/controllers/member.controller.js` | `GET/POST /api/projects/:id/members`, `DELETE /api/projects/:id/members/:userId` |
| `src/controllers/task.controller.js` | Tâches : création, `PUT /api/tasks/:id` (champs envoyés seulement, acteur membre du projet), statut, suppression logique |
| `src/utils/validation.utils.js` | Validation des entrées : UUID, courriel, longueur des textes, date d'échéance (17 h UTC) |
| `database/migrations/011_tasks_suppression_logique.sql` | `tasks.is_active` (suppression logique) |
| `tests/integration/formulaires.it.mjs` | Formulaires et membres sur une vraie base, par les vraies routes HTTP (bloc 13) |
| `src/config/storage.js` | Dossier des fichiers audio (`UPLOAD_DIR`), type audio, chemin sûr (`resolveAudioPath`) |
| `src/models/meeting-detail.model.js` | Détail d'une réunion en six requêtes parallèles ; nom du fichier audio (bloc 14) |
| `src/controllers/meeting-detail.controller.js` | `GET /api/meetings/:id/details`, `GET /api/meetings/:id/audio` (après vérification d'appartenance) |
| `tests/integration/detail-reunion.it.mjs` | Détail de réunion et audio (`Range`, accès) sur une vraie base (bloc 14) |
| `src/middlewares/upload.middleware.js` | Envoi audio : types acceptés, extension tirée du type, `MAX_AUDIO_MB`, erreurs 413 / 415 |
| `src/services/whisper.service.js` | Whisper en ligne de commande : vérification de ffmpeg, délai maximal, erreurs actionnables, silence détecté |
| `src/services/meeting-processing.service.js` | Traitement en arrière-plan : Whisper → transcription → audio adopté → mémoire → analyse (bloc 20) |
| `src/models/processing.model.js` | État de la transcription ; remise en erreur des traitements interrompus au démarrage |
| `database/migrations/012_transcription_asynchrone.sql` | `meetings.transcription_status` et `transcription_error` |
| `tests/integration/enregistrement.it.mjs` | Envoi et transcription en arrière-plan avec le **vrai** Whisper (bloc 20) |
| `src/models/dashboard.model.js` | Compteurs du tableau de bord en SQL (tâches ouvertes et en retard, alertes ouvertes, réunions du mois) et prochaines échéances |
| `src/controllers/dashboard.controller.js` | `GET /api/dashboard` (bloc 21) |
| `database/migrations/013_projet_reunion_source.sql` | `projects.source_meeting_id` : réunion dont l'analyse a créé le projet |
| `tests/integration/resultats.it.mjs` | Analyse (IA simulée), projet nouveau, relance sans doublon, compteurs du tableau de bord (bloc 21) |
| `src/models/calendar.model.js` | Réunions et échéances d'une plage de jours, accès vérifié dans la requête (bloc 16) |
| `src/controllers/calendar.controller.js` | `GET /api/calendar` : plage validée (92 jours au plus), filtre par projet avec contrôle d'appartenance (bloc 16) |
| `database/migrations/014_reunion_date_prevue.sql` | `meetings.scheduled_at` : date prévue d'une réunion |
| `tests/integration/calendrier.it.mjs` | Calendrier sur une vraie base : bornes de la plage, filtre par projet, accès (bloc 16) |
| `src/config/security.js` | CORS (`FRONTEND_URL`), limitation de débit de la connexion, vérification du secret JWT au démarrage (bloc 17) |
| `database/preparer-base-test.mjs` | Recrée la base de test `veridian_test` (schéma + migrations) ; refuse tout nom sans `_test` (bloc 17) |
| `database/migrations/015_courriel_unique_insensible_casse.sql` | Un seul compte par courriel, sans tenir compte de la casse |
| `tests/api/` | Tests d'API sur vraie base : `auth`, `crud`, `acces`, `pipeline`, `seed` (`*.api.test.js`) ; `helpers.js` simule l'IA (blocs 17 et 22) |
| `database/seed.js` | Données de test facultatives ; `seedTestData(pool)` est aussi utilisée par les tests (bloc 22) |
| `src/utils/jwt.utils.js` | Génération et vérification des tokens JWT |
| `src/utils/hash.utils.js` | Hachage bcrypt |

### Fichiers clés du frontend

| Fichier | Rôle |
|---|---|
| `src/api/client.js` | Jeton dans `localStorage` et appels de connexion / inscription (un 401 = mauvais mot de passe) |
| `src/services/api.js` | Client des pages protégées : URL relatives `/api`, envoi de fichiers (`FormData`), téléchargement binaire, 401 = session expirée → page de connexion avec message |
| `src/components/SessionNotice.jsx` | Bandeau « session expirée » affiché une fois sur la page de connexion |
| `src/components/ServiceStatus.jsx` | Pastilles d'état réelles de l'en-tête (`GET /api/health` : clé Gemini, SMTP ou courriels simulés) |
| `src/utils/dates.js` | Durées relatives passé/futur, dates, échéances lues en UTC, tâche en retard |
| `src/utils/labels.js` | Libellés et couleurs des statuts, priorités et gravités (mêmes clés que la base) |
| `src/utils/dates.test.js` | Tests des dates (`npm test` dans `Projet/Frontend`, testeur intégré à Node) |
| `src/components/Modal.jsx`, `src/components/form.jsx` | Fenêtre de dialogue accessible et champs de formulaire partagés |
| `src/components/ProjectFormModal.jsx`, `MeetingFormModal.jsx`, `TaskFormModal.jsx` | Formulaires de création (et de modification pour les tâches) |
| `src/pages/ProjectDetailPage.jsx` | Page `/projects/:id` : membres (ajout, retrait) et réunions du projet |
| `src/pages/MeetingDetailPage.jsx` | Page `/meetings/:id` : audio, transcription modifiable, décisions, tâches, contradictions, risques, courriels ; suivi en direct du traitement |
| `src/components/AudioRecorder.jsx` | Enregistrement dans le navigateur (MediaRecorder, pause, niveau du micro, écoute, envoi avec progression) |
| `src/components/AddRecordingPanel.jsx` | Onglets Enregistrer / Téléverser un fichier / Coller un texte |
| `src/utils/recording.js` | Format d'enregistrement, messages d'erreur du micro, vérification d'un fichier (testé dans `recording.test.js`) |
| `src/pages/TasksPage.jsx` | « Mes tâches » : filtres (statut, retard, projet, acteur), tri par échéance, changement de statut |
| `src/utils/tasks.js` | Filtres, tri par échéance et regroupement par acteur (testés dans `tasks.test.js`) |
| `src/pages/CalendarPage.jsx` | Calendrier mensuel : grille accessible au clavier, légende, filtre par projet, liste du jour (bloc 16) |
| `src/utils/calendar.js` | Grille du mois, jours locaux et UTC, regroupement des événements, navigation au clavier (testés dans `calendar.test.js`) |
| `src/utils/validation.js` | Validation côté client, mêmes règles que le serveur (testée dans `validation.test.js`) |

---

## Workflow Git — règles sans exception

1. Créer `bloc-XX` depuis `main` au démarrage du bloc
2. Développer jusqu'à un état fonctionnel et testable
3. Ouvrir une *pull request* vers `main`
4. Fusionner par **merge commit uniquement** : `gh pr merge --merge` — jamais `--squash`, `--rebase`, ni `--delete-branch`
5. La branche **n'est jamais supprimée** après fusion
6. `main` reste déployable à tout moment

### État des branches

| Branches | Statut |
|---|---|
| `main` | Active — base de production |
| `bloc-01` à `bloc-11`, `bloc-15-frontend-decisions`, `fix/securite-et-installation` | Fusionnées |
| `fix/installation-linux` (PR #30) | PR ouverte, à tester |
| `bloc-19-pipeline-ia` (PR #31) | PR ouverte, à tester |
| `chore/hygiene-depot` (PR #32) | PR ouverte — empilée sur `bloc-19-pipeline-ia` |
| `bloc-12-frontend-api` (PR #33) | PR ouverte — empilée sur `chore/hygiene-depot` |
| `bloc-13-formulaires` (PR #34) | PR ouverte — empilée sur `bloc-12-frontend-api` |
| `bloc-14-detail-reunion` (PR #35) | PR ouverte — empilée sur `bloc-13-formulaires` |
| `bloc-20-enregistrement` (PR #36) | PR ouverte — empilée sur `bloc-14-detail-reunion` |
| `bloc-21-resultats-taches` (PR #37) | PR ouverte — empilée sur `bloc-20-enregistrement` |
| `bloc-16-calendrier` (PR #38) | PR ouverte — empilée sur `bloc-21-resultats-taches` |
| `bloc-17-tests-securite` (PR #39) | PR ouverte — empilée sur `bloc-16-calendrier` |
| `bloc-22-donnees-test` | PR ouverte — empilée sur `bloc-17-tests-securite` |
| `bloc-18` | À faire |

Une branche « empilée » part d'une branche pas encore fusionnée : fusionner les PR dans l'ordre du tableau. Après chaque fusion, la PR suivante ne montre plus que ses propres commits.

---

## Tests

Tout se lance depuis `Projet/Backend` (base PostgreSQL démarrée pour les tests d'API).

| Commande | Ce qu'elle fait | Base utilisée |
|---|---|---|
| `npm test` | Tests unitaires (base et IA simulées), rapides | aucune |
| `npm run test:api` | Tests d'API par les vraies routes HTTP | `veridian_test`, **recréée** à chaque exécution |
| `npm run test:all` | Les deux | `veridian_test` |
| `npm run test:coverage` | Les deux, avec le rapport de couverture (`coverage/index.html`) | `veridian_test` |
| `npm run test:db` | Recrée seulement la base de test | `veridian_test` |

- **La base de développement `veridian` n'est jamais touchée** : la base de test doit avoir un nom en `_test`, sinon le script refuse de s'exécuter.
- Dans les tests d'API, **seule l'IA est simulée** (réponses prévues et vecteurs calculés à partir des mots). La base, les contrôles d'accès, pgvector, le PDF et les courriels sont réels. Aucun courriel ne part : les tests forcent le mode console.
- Les scénarios `tests/integration/*.it.mjs` (blocs 13 à 21) restent disponibles : `node tests/integration/<nom>.it.mjs`. Celui du bloc 20 utilise le vrai Whisper.
- Frontend : `npm test` (fonctions pures, testeur intégré à Node) et `npm run build` dans `Projet/Frontend`.

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port Express. Le serveur de développement Vite transmet `/api` à `http://localhost:3000` ; pour un autre port, lancer Vite avec `BACKEND_URL` (ci-dessous) |
| `BACKEND_URL` | `http://localhost:3000` | **Variable du frontend** (lue par `vite.config.js` au lancement de Vite, pas dans `.env`) : adresse du backend. Sert à lancer une seconde instance, par exemple sur une base de test |
| `DB_HOST` | `localhost` | Hôte PostgreSQL |
| `DB_PORT` | `5432` | Port PostgreSQL |
| `DB_NAME` | `veridian` | Nom de la base |
| `DB_USER` | `veridian_user` | Utilisateur PostgreSQL |
| `DB_PASSWORD` | `veridian_pass` | Mot de passe PostgreSQL |
| `JWT_SECRET` | généré par le script | Secret de signature des tokens (obligatoire, **32 caractères au minimum** : sinon le serveur refuse de démarrer ; ne jamais le partager) |
| `JWT_EXPIRES_IN` | `7d` | Durée de vie du token |
| `AI_PROVIDER` | `gemini` | Fournisseur IA |
| `AI_MODEL` | `gemini-2.5-flash` | Modèle IA (les anciens `gemini-1.5-*` sont retirés par Google ; le script les remplace) |
| `GEMINI_API_KEY` | — | Clé Google AI Studio (obligatoire pour l'IA) |
| `WHISPER_MODE` | `local` | Mode Whisper |
| `WHISPER_MODEL` | `small` | Modèle Whisper (`tiny`/`small`/`medium`) |
| `WHISPER_LANGUAGE` | `fr` | Langue de transcription |
| `WHISPER_TIMEOUT_MIN` | `30` | Durée maximale d'une transcription, en minutes (au-delà, elle est arrêtée) |
| `WHISPER_COMMAND` / `FFMPEG_COMMAND` | vide | Chemin complet de `whisper` / `ffmpeg` s'ils ne sont pas dans le `PATH` |
| `MAX_AUDIO_MB` | `200` | Taille maximale d'un fichier audio envoyé, en Mo (413 au-delà) |
| `SMTP_HOST` | vide | Serveur SMTP. Vide = mode console : les courriels sont affichés dans le terminal du backend, rien n'est envoyé |
| `SMTP_PORT` | `587` | Port SMTP |
| `SMTP_SECURE` | `false` | `true` pour TLS direct (port 465) |
| `SMTP_USER` / `SMTP_PASSWORD` | vide | Identifiants SMTP (Gmail : mot de passe d'application) |
| `FRONTEND_URL` | `http://localhost:5173` | Origine(s) autorisée(s) à appeler l'API depuis un navigateur (CORS), séparées par des virgules |
| `AUTH_RATE_LIMIT` | `20` | Essais de connexion ou d'inscription permis par adresse IP et par fenêtre ; au-delà : 429 |
| `AUTH_RATE_WINDOW_MIN` | `15` | Durée de la fenêtre de limitation, en minutes |
| `MAIL_FROM` | `Veridian <no-reply@veridian.local>` | Expéditeur des courriels |

Les valeurs `DB_*` correspondent à `docker-compose.yml` : ne pas les changer sans modifier aussi ce fichier.

---

## Résolution de problèmes

| Symptôme | Solution |
|---|---|
| `winget` est introuvable | Mettre Windows à jour, ou installer « Programme d'installation d'application » depuis le Microsoft Store, puis relancer |
| Le script s'arrête après l'installation de Docker | Normal : redémarrer Windows. Le script se relance seul à l'ouverture de session ; sinon double-cliquer sur `Demarrer.bat` |
| « La virtualisation est DESACTIVEE dans le BIOS/UEFI » | Redémarrer dans le BIOS/UEFI, activer *Intel Virtualization Technology* (VT-x) ou *SVM Mode* (AMD-V), enregistrer, relancer `Demarrer.bat`. Dans une machine virtuelle : activer la virtualisation imbriquée |
| La fenêtre de confirmation administrateur (UAC) a été refusée | Relancer `Demarrer.bat` et accepter : l'activation de WSL 2 exige les droits administrateur |
| Docker ne répond pas après 5 minutes | Ouvrir Docker Desktop une fois, attendre l'icône verte, relancer. Si WSL pose problème : `wsl --update` dans un terminal administrateur, puis redémarrer |
| Port 5432 déjà utilisé | Un PostgreSQL est déjà installé sur le PC : arrêter son service (`services.msc`), relancer |
| Port 3000 ou 5173 déjà utilisé | Fermer le programme qui l'occupe (ou l'ancienne fenêtre « Backend »/« Frontend »), relancer |
| L'application démarre mais l'IA ne répond pas | `GEMINI_API_KEY` absente ou invalide dans `Projet\Backend\.env` : corriger puis relancer |
| Le `.env` n'est pas pris en compte | Vérifier le nom exact `.env` (pas `.env.txt`) et l'emplacement `Projet\Backend\` |
| La transcription audio échoue | Ouvrir une **nouvelle** fenêtre PowerShell (mise à jour du PATH) et relancer `Demarrer.bat` ; vérifier avec `whisper --help` et `ffmpeg -version` |
| Erreur de connexion PostgreSQL | `docker compose down -v` puis `docker compose up -d` et relancer `Demarrer.bat` (réinitialise la base) |
| `<` refusé dans PowerShell avec `docker exec` | Utiliser `docker cp` puis `psql -f` (voir « Démarrage manuel ») |
| Whisper introuvable (Ubuntu) | `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc` |

---

*Veridian — INF1430 — Francis Côté*
