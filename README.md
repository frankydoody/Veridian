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
│   │   │   ├── seed.js            # données de démonstration (3 comptes, projets, réunions...)
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

Se connecter avec un compte de démonstration (voir ci-dessous), ou créer son propre compte sur la page d'inscription.

### Données de démonstration

Au premier démarrage (base sans aucun utilisateur), le script ajoute un jeu de données pour pouvoir tester immédiatement. **Mot de passe de tous les comptes : `12345678`**

| Compte | Rôle | Projets accessibles |
|---|---|---|
| `admin@example.com` | admin | Refonte du site web client, Application mobile Atlas |
| `marie.tremblay@example.com` | membre | Refonte du site web client, Application mobile Atlas |
| `samuel.gagnon@example.com` | membre | Refonte du site web client, Plan de relève RH (confidentiel) |

Contenu : 3 projets, 7 réunions (6 terminées avec transcription en français, 1 planifiée sans audio pour tester le téléversement), 15 décisions (confirmées, provisoires, contredites), 2 alertes de contradiction (sévérité haute et moyenne), 13 tâches (à faire, en cours, terminées, une en retard) réparties entre les trois comptes.

Scénarios de test utiles :
- **Contradictions** : dans « Refonte du site web client », l'hébergement chez Cloudflare Pages (lancement) est contredit par la migration vers un serveur interne (suivi technique) ; dans « Application mobile Atlas », le report des notifications push est contredit par leur ajout pour la démonstration.
- **Isolation des données** : « Plan de relève RH (confidentiel) » n'appartient qu'à Samuel ; `admin@example.com` et Marie ne doivent ni le voir ni y accéder (réponse 404).
- **Tâches** : chaque utilisateur ne voit que ses propres tâches.
- **Mémoire / chat** : les transcriptions et décisions sont indexées au premier démarrage si la clé Gemini est valide ; sinon, relancer l'indexation d'une réunion avec `POST /api/memory/index/:meetingId`.

Commandes (depuis `Projet/Backend`) :

```bash
node database/seed.js                  # ajoute les données si elles n'existent pas (sinon ne fait rien)
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
| `src/services/contradiction.service.js` | Compare les nouvelles décisions aux décisions passées du projet et crée les alertes (bloc 08) |
| `src/models/alert.model.js` | Alertes : création avec marquage de la décision contredite (transaction), liste, résolution |
| `src/controllers/alert.controller.js` | `GET /api/alerts/project/:projectId[?status=open]`, `PATCH /api/alerts/:id/resolve` |
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
| `bloc-01` à `bloc-07`, `bloc-10`, `bloc-11`, `fix/securite-et-installation` | Fusionnées |
| `bloc-08-contradictions` | En revue (PR) |
| `bloc-09`, `bloc-12` à `bloc-18` | À faire |

---

## Variables d'environnement

| Variable | Défaut | Description |
|---|---|---|
| `PORT` | `3000` | Port Express — **doit rester 3000** (le frontend appelle `http://localhost:3000`) |
| `DB_HOST` | `localhost` | Hôte PostgreSQL |
| `DB_PORT` | `5432` | Port PostgreSQL |
| `DB_NAME` | `veridian` | Nom de la base |
| `DB_USER` | `veridian_user` | Utilisateur PostgreSQL |
| `DB_PASSWORD` | `veridian_pass` | Mot de passe PostgreSQL |
| `JWT_SECRET` | généré par le script | Secret de signature des tokens (obligatoire ; ne jamais le partager) |
| `JWT_EXPIRES_IN` | `7d` | Durée de vie du token |
| `AI_PROVIDER` | `gemini` | Fournisseur IA |
| `AI_MODEL` | `gemini-2.5-flash` | Modèle IA (les anciens `gemini-1.5-*` sont retirés par Google ; le script les remplace) |
| `GEMINI_API_KEY` | — | Clé Google AI Studio (obligatoire pour l'IA) |
| `WHISPER_MODE` | `local` | Mode Whisper |
| `WHISPER_MODEL` | `small` | Modèle Whisper (`tiny`/`small`/`medium`) |
| `WHISPER_LANGUAGE` | `fr` | Langue de transcription |

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
