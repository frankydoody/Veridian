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
| LLM | Gemini 1.5 Flash (Google AI) |
| Frontend | React 19 / Vite / Tailwind CSS |
| Tests | Jest + dotenv-cli |

---

## Structure du dépôt

```
Veridian/
├── start.ps1              # Démarrage automatisé Windows
├── start.sh               # Démarrage automatisé Ubuntu
├── docker-compose.yml     # PostgreSQL 16 + pgvector
├── Projet/
│   ├── Backend/
│   │   ├── app.js         # Config Express
│   │   ├── server.js      # Point d'entrée HTTP
│   │   ├── package.json
│   │   ├── .env           # Variables (non versionné)
│   │   ├── database/
│   │   │   ├── schema.sql         # schéma de base (9 tables) — à appliquer AVANT les migrations
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

## Prérequis

| Logiciel | Windows | Ubuntu |
|---|---|---|
| Git | git-scm.com | `sudo apt install git` |
| Node.js 20 | nvm-windows | Via nvm |
| Docker Desktop | docker.com | Via apt |
| Python 3 | python.org | `sudo apt install python3-pip` |
| ffmpeg | gyan.dev | `sudo apt install ffmpeg` |
| Whisper | `pip install openai-whisper` | `pip3 install openai-whisper --break-system-packages` |

### Node.js 20 via nvm

**Windows** — installer nvm-setup.exe en administrateur :

```powershell
nvm install 20
nvm use 20
node --version   # v20.x.x
```

**Ubuntu :**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20 && nvm use 20 && nvm alias default 20
```

### Docker — Ubuntu

```bash
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker
```

### ffmpeg — Windows

1. Télécharger `ffmpeg-release-essentials.zip` sur gyan.dev
2. Extraire dans `C:\ffmpeg`
3. Ajouter `C:\ffmpeg\bin` au PATH système

### Clé API Gemini (gratuit)

Aller sur aistudio.google.com/app/apikey → Create API Key → copier la clé

---

## Installation et démarrage

### 1. Cloner le projet

**Windows :**

```powershell
cd C:\Dev
git clone https://github.com/frankydoody/Veridian.git
cd Veridian
```

**Ubuntu :**

```bash
cd ~/dev
git clone https://github.com/frankydoody/Veridian.git
cd Veridian
```

### 2. Créer le fichier .env

Créer `Projet/Backend/.env` :

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=veridian
DB_USER=veridian_user
DB_PASSWORD=veridian_pass
JWT_SECRET=remplacer_par_une_longue_phrase_secrete
JWT_EXPIRES_IN=7d
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash
GEMINI_API_KEY=coller_la_cle_gemini_ici
WHISPER_MODE=local
WHISPER_MODEL=small
WHISPER_LANGUAGE=fr
```

### 3. Démarrage automatique (recommandé)

**Windows** — Docker Desktop doit être démarré manuellement d'abord :

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

**Ubuntu :**

```bash
chmod +x start.sh   # une seule fois
./start.sh
```

Le script exécute dans l'ordre :

1. Vérification des prérequis (`docker`, `node`, `npm`, fichier `.env`)
2. Démarrage de la DB et attente du statut `healthy`
3. Installation des dépendances npm si absentes
4. Ouverture des terminaux **Veridian - Backend** et **Veridian - Frontend**
5. Ouverture du navigateur

### Services disponibles

| Service | Adresse |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3000 |
| Health check | http://localhost:3000/api/health |

### Démarrage manuel

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

> ⚠️ PowerShell ne supporte pas `<` pour `docker exec`. Utiliser `docker cp` puis `psql -f` (voir ci-dessus) ou `cmd`. Les scripts `start.sh` et `start.ps1` font ces étapes automatiquement sur une base vide.

> ⚠️ Docker Desktop (Windows) ne démarre pas automatiquement au boot — le lancer manuellement avant `start.ps1`.

### Arrêt

```bash
# Ctrl+C dans chaque terminal, puis :
docker compose down
```

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
| 08 | Détection contradictions & Alertes | Todo | Comparaison décisions, alertes persistées |
| 09 | Chat mémoire & Export PDF | Todo | Interface chat RAG, export PDF par projet |

### Frontend

| Bloc | Titre | Statut | Description |
|---|---|---|---|
| 10 | Frontend Auth | ✅ Done | Pages connexion/inscription, token JWT côté client |
| 11 | Frontend Dashboard | ✅ Done | Pages Projets, Réunions, Tâches, Mémoire (statique) |
| 12 | Frontend API Connect | Todo | Connexion à l'API réelle, données dynamiques |
| 13 | Frontend Formulaires | Todo | Formulaires création projet/réunion/tâche + validation |
| 14 | Frontend Réunion Détaillée | Todo | Lecteur audio, transcription, décisions liées |
| 15 | Frontend Décisions & Contradictions | Todo | Vue agrégée, alertes en temps réel |
| 16 | Frontend Calendrier de projet | Todo | Vue calendrier mensuel, navigation |

### Qualité et livraison

| Bloc | Titre | Statut | Description |
|---|---|---|---|
| 17 | Tests d'intégration & Qualité | Todo | Suite Jest : auth, transcription, mémoire RAG |
| 18 | Déploiement & Documentation finale | Todo | Guide déploiement, variables documentées, TN4 |

---

## Architecture backend

### Schéma de base de données

9 tables, 17 index. Préfixes : `core_` (partagé), `mtg_` (réunions).

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
| `src/utils/jwt.utils.js` | Génération et vérification des tokens JWT |
| `src/utils/hash.utils.js` | Hachage bcrypt |

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
| `bloc-01` à `bloc-07`, `bloc-10`, `bloc-11` | Fusionnées |
| `bloc-08`, `bloc-09`, `bloc-12` à `bloc-18` | À faire |

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port Express |
| `DB_HOST` | `localhost` | Hôte PostgreSQL |
| `DB_PORT` | `5432` | Port PostgreSQL |
| `DB_NAME` | `veridian` | Nom de la base |
| `DB_USER` | `veridian_user` | Utilisateur PostgreSQL |
| `DB_PASSWORD` | `veridian_pass` | Mot de passe PostgreSQL |
| `JWT_SECRET` | — | Phrase secrète (obligatoire) |
| `JWT_EXPIRES_IN` | `7d` | Durée de vie du token |
| `AI_PROVIDER` | `gemini` | Fournisseur IA |
| `AI_MODEL` | `gemini-1.5-flash` | Modèle IA |
| `GEMINI_API_KEY` | — | Clé Google AI Studio (obligatoire) |
| `WHISPER_MODE` | `local` | Mode Whisper |
| `WHISPER_MODEL` | `small` | Modèle Whisper (`tiny`/`small`/`medium`) |
| `WHISPER_LANGUAGE` | `fr` | Langue de transcription |

---

## Résolution de problèmes

**Docker Desktop ne démarre pas (Windows)** → Lancer manuellement depuis le menu Démarrer, attendre l'icône verte

**PowerShell : erreur `<` avec docker exec** → Utiliser `docker cp` puis `docker exec ... psql -f` (voir « Démarrage manuel »), ou `cmd`

**Erreur de connexion PostgreSQL**

```bash
docker compose down -v && docker compose up -d
# Attendre 20s puis réappliquer le schéma
```

**Port 3000 déjà utilisé** → `PORT=3001` dans `.env`

**Whisper introuvable (Ubuntu)** → `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc`

---

*Veridian — INF1430 — Francis Côté*
