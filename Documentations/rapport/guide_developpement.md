# Guide de développement — Veridian
## Document de cours — INF4018
**Auteur :** Francis Côté  
**Version :** 1.0  

---

## Table des matières

1. [Présentation du projet](#1-présentation-du-projet)
2. [Installation de l'environnement de développement](#2-installation-de-lenvironnement-de-développement)
3. [Initialisation du projet](#3-initialisation-du-projet)
4. [Configuration de la base de données](#4-configuration-de-la-base-de-données)
5. [Initialisation du Backend Node.js](#5-initialisation-du-backend-nodejs)
6. [Connexion à PostgreSQL](#6-connexion-à-postgresql)
7. [Schéma SQL — Modélisation de la base de données](#7-schéma-sql--modélisation-de-la-base-de-données)
8. [Utilitaires de sécurité](#8-utilitaires-de-sécurité)

---

## 1. Présentation du projet

### 1.1 Problématique

Les équipes en entreprise prennent leurs décisions importantes lors de réunions. Or, ces décisions ne sont jamais formellement documentées, archivées ni reliées les unes aux autres. Les comptes rendus manuels sont partiels, subjectifs et rarement consultés. Lorsqu'une équipe souhaite retrouver pourquoi elle a pris une décision plusieurs semaines auparavant, l'information est perdue ou éparpillée dans des fils de courriels et des notes personnelles.

Les outils actuels de transcription automatique, tels qu'Otter.ai et Fireflies.ai, se limitent à produire des transcriptions textuelles et des résumés généraux, sans aucune capacité de mémoire organisationnelle structurée ni de détection de contradictions entre décisions successives.

### 1.2 Solution — Veridian

Veridian est une application web complète qui permet aux équipes d'entreprise de :

- Enregistrer automatiquement les réunions directement depuis le navigateur
- Transcrire l'audio via l'API OpenAI Whisper
- Extraire les décisions structurées via l'API Anthropic Claude
- Maintenir une mémoire organisationnelle vectorielle persistante (RAG + pgvector)
- Détecter automatiquement les contradictions entre décisions
- Interroger l'historique en langage naturel via un chat IA
- Générer des rapports PDF exportables

### 1.3 Architecture générale

Veridian suit une architecture **client-serveur en trois couches** :

```
┌─────────────────┐     HTTP/REST      ┌─────────────────┐
│                 │ ─────────────────► │                 │
│  Frontend       │                    │  Backend        │
│  React 18/Vite  │ ◄───────────────── │  Node.js/Express│
│  (navigateur)   │     JSON           │  (port 3000)    │
└─────────────────┘                    └────────┬────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │   PostgreSQL 16        │
                                    │   + pgvector 0.8.3     │
                                    │   (Docker, port 5432)  │
                                    └───────────────────────┘
```

- **Frontend (React/Vite)** : Interface utilisateur exécutée dans le navigateur. Gère l'enregistrement audio, l'affichage des décisions, le chat et la gestion des projets.
- **Backend (Node.js/Express)** : Serveur API REST qui traite les requêtes du frontend, appelle les APIs externes (Whisper, Claude) et gère la base de données.
- **Base de données (PostgreSQL + pgvector)** : Stocke les données relationnelles (utilisateurs, projets, décisions) et les vecteurs d'embeddings pour la recherche sémantique.

### 1.4 Structure du dépôt

```
Veridian/
├── Documentations/
│   ├── rapport/         # Documents académiques (TN1, TN2, TN4, guides)
│   └── uml/             # Diagrammes UML exportés
├── Projet/
│   ├── Backend/         # API Node.js/Express
│   └── Frontend/        # Interface React/Vite (à venir)
├── docker-compose.yml   # Orchestration Docker (PostgreSQL + pgvector)
├── .gitignore           # Fichiers exclus du contrôle de version
└── README.md            # Documentation principale du projet
```

---

## 2. Installation de l'environnement de développement

Cette section décrit l'installation complète de tous les outils nécessaires au développement de Veridian sur Windows 10/11 et Ubuntu 22.04/24.04.

### 2.1 Git — Système de contrôle de version

**Définition :** Git est un système de contrôle de version distribué qui enregistre chaque modification du code source. Il permet de revenir à un état antérieur, de travailler en parallèle sur différentes fonctionnalités et de collaborer avec d'autres développeurs.

**Pourquoi Git est indispensable :**
- Sauvegarde versionnée de chaque étape du développement
- Possibilité de revenir en arrière en cas d'erreur
- Partage du code avec le superviseur via GitHub
- Standard universel en développement professionnel

**Installation sur Windows :**
1. Accéder à https://git-scm.com/download/win
2. Télécharger l'installateur 64-bit
3. Lancer l'exécutable et suivre l'assistant
4. Sélectionner Visual Studio Code comme éditeur par défaut lorsque demandé
5. Accepter toutes les autres options par défaut

**Installation sur Ubuntu :**
```bash
sudo apt update && sudo apt install -y git
```

**Configuration initiale (Windows et Ubuntu) :**
```bash
git config --global user.name "Francis Cote"
git config --global user.email "ton@email.com"
```

Ces deux commandes configurent l'identité de l'auteur qui apparaîtra dans chaque commit. La configuration `--global` s'applique à tous les projets Git sur la machine.

**Vérification :**
```bash
git --version
# Résultat attendu : git version 2.x.x
```

### 2.2 Node.js 20 LTS via nvm

**Définition :** Node.js est un environnement d'exécution JavaScript côté serveur, basé sur le moteur V8 de Chrome. Il permet d'exécuter du JavaScript en dehors du navigateur, ce qui rend possible la création de serveurs web, d'APIs et d'outils en ligne de commande.

**Pourquoi nvm plutôt qu'une installation directe :**
nvm (Node Version Manager) est un gestionnaire de versions de Node.js. Il permet d'installer et de basculer entre plusieurs versions selon les besoins de chaque projet. En environnement professionnel, il est courant de travailler sur des projets nécessitant des versions différentes de Node.js. nvm élimine les conflits de version.

**Pourquoi Node.js 20 LTS :**
LTS signifie Long Term Support — cette version bénéficie d'une maintenance étendue (corrections de sécurité, corrections de bugs) pendant plusieurs années. C'est la version recommandée pour les projets en production.

**Installation sur Windows :**
1. Accéder à https://github.com/coreybutler/nvm-windows/releases
2. Télécharger `nvm-setup.exe`
3. Lancer l'installateur en tant qu'administrateur
4. Fermer tous les terminaux ouverts
5. Ouvrir un nouveau terminal PowerShell en tant qu'administrateur

```powershell
nvm install 20
nvm use 20
node --version   # v20.x.x
npm --version    # 10.x.x
```

**Installation sur Ubuntu :**
```bash
# Télécharger et exécuter le script d'installation de nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Recharger la configuration du shell
source ~/.bashrc

# Installer et activer Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Vérification
node --version   # v20.x.x
npm --version    # 10.x.x
```

**npm (Node Package Manager) :** npm est le gestionnaire de packages intégré à Node.js. Il permet d'installer des bibliothèques tierces (appelées packages ou dépendances) depuis le registre public npmjs.com. Il est installé automatiquement avec Node.js.

### 2.3 Docker Desktop

**Définition :** Docker est une plateforme de conteneurisation. Un conteneur est un environnement d'exécution isolé qui emballe une application avec toutes ses dépendances. Contrairement à une machine virtuelle, un conteneur partage le noyau du système hôte, ce qui le rend léger et rapide.

**Pourquoi Docker pour la base de données :**
Au lieu d'installer PostgreSQL directement sur la machine (installation complexe, configuration manuelle, risque de conflits), Docker lance PostgreSQL dans un conteneur isolé. Avantages :
- Installation en une seule commande
- Environnement identique sur Windows et Ubuntu
- Facilité de réinitialisation (supprimer et recréer le conteneur)
- Aucune pollution du système hôte

**Installation sur Windows :**
1. Accéder à https://www.docker.com/products/docker-desktop/
2. Télécharger et lancer l'installateur
3. Activer WSL 2 (Windows Subsystem for Linux) lorsque proposé — meilleure performance
4. Redémarrer l'ordinateur si demandé

**Installation sur Ubuntu :**
```bash
# Ajouter la clé GPG officielle Docker
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Ajouter le dépôt Docker
echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installer Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Ajouter l'utilisateur au groupe docker (évite sudo à chaque commande)
sudo usermod -aG docker $USER
newgrp docker
```

**Vérification :**
```bash
docker --version
docker compose version
```

### 2.4 Visual Studio Code

**Définition :** Visual Studio Code (VS Code) est un éditeur de code source gratuit développé par Microsoft. Léger et extensible, il supporte une grande variété de langages de programmation via un système d'extensions.

**Installation :** https://code.visualstudio.com/ (Windows et Ubuntu)

**Extensions recommandées pour Veridian :**

| Extension | Rôle |
|---|---|
| ESLint | Détection des erreurs JavaScript en temps réel |
| Prettier | Formatage automatique du code à la sauvegarde |
| GitLens | Visualisation avancée de l'historique Git |
| REST Client | Test des endpoints API directement dans l'éditeur |
| Docker | Gestion des conteneurs depuis l'éditeur |
| DotENV | Coloration syntaxique des fichiers `.env` |

### 2.5 Authentification GitHub par Personal Access Token

GitHub a désactivé l'authentification par mot de passe pour les opérations Git en 2021 pour des raisons de sécurité. Un Personal Access Token (PAT) est utilisé à la place.

**Création du token :**
1. Accéder à https://github.com/settings/tokens
2. Cliquer **Generate new token (classic)**
3. Nommer le token (ex: `veridian-dev`)
4. Sélectionner une expiration de 90 jours
5. Cocher la case **repo** (accès complet aux dépôts)
6. Cliquer **Generate token**
7. Copier le token immédiatement — il n'est affiché qu'une seule fois

**Configuration pour éviter la saisie répétée :**
```bash
git config --global credential.helper store
```

Lors du prochain `git push`, Git demandera le nom d'utilisateur et le token, puis les sauvegardera automatiquement.

---

## 3. Initialisation du projet

### 3.1 Clonage du dépôt

```bash
git clone https://github.com/frankydoody/Veridian.git
cd Veridian
```

**`git clone`** : Télécharge une copie complète du dépôt distant (GitHub) sur la machine locale, incluant tout l'historique des commits.

**Emplacement recommandé :**
- Windows : `C:\Dev\Veridian`
- Ubuntu : `~/dev/Veridian`

### 3.2 Structure de dossiers

La structure suivante est créée manuellement pour organiser le projet :

```bash
# Windows
mkdir Documentations\rapport Documentations\uml
mkdir Projet\Backend\src\config
mkdir Projet\Backend\src\controllers
mkdir Projet\Backend\src\services
mkdir Projet\Backend\src\routes
mkdir Projet\Backend\src\middlewares
mkdir Projet\Backend\src\models
mkdir Projet\Backend\src\utils
mkdir Projet\Backend\database\migrations
mkdir Projet\Backend\tests
mkdir Projet\Backend\uploads
mkdir Projet\Frontend

# Ubuntu
mkdir -p Documentations/{rapport,uml}
mkdir -p Projet/Backend/src/{config,controllers,services,routes,middlewares,models,utils}
mkdir -p Projet/Backend/{database/migrations,tests,uploads}
mkdir -p Projet/Frontend
```

**Convention de nommage :** Les dossiers principaux utilisent le PascalCase (`Backend`, `Frontend`, `Documentations`) pour différencier visuellement les répertoires structurels des fichiers de code.

### 3.3 Le fichier `.gitignore`

**Définition :** Le fichier `.gitignore` liste les fichiers et dossiers que Git doit ignorer — c'est-à-dire ne jamais versionner ni envoyer sur GitHub.

**Création :**
```bash
# Windows PowerShell
New-Item .gitignore -ItemType File

# Ubuntu
touch .gitignore
```

**Contenu du fichier :**
```
# Dépendances npm
node_modules/

# Variables d'environnement (clés API, mots de passe)
.env
.env.local
.env.production

# Fichiers audio temporaires
Projet/Backend/uploads/
*.mp3
*.wav
*.webm
*.m4a

# Builds compilés
dist/
build/

# Logs
*.log
logs/
npm-debug.log*

# Fichiers système
.DS_Store
Thumbs.db
Desktop.ini

# Préférences IDE
.vscode/settings.json
.idea/
```

**Explication des exclusions critiques :**

- **`node_modules/`** : Dossier contenant les dépendances npm téléchargées. Peut contenir plus de 50 000 fichiers et peser plusieurs centaines de Mo. Ce dossier est régénéré par `npm install` et ne doit jamais être versionné.
- **`.env`** : Contient les clés API (OpenAI, Anthropic) et les mots de passe de base de données. Si ce fichier est commité sur GitHub, ces informations sensibles sont exposées publiquement. C'est la règle de sécurité la plus importante du projet.
- **`uploads/`** : Fichiers audio temporaires uploadés par les utilisateurs. Ces fichiers sont traités puis supprimés — ils n'ont pas de valeur permanente.

**Règles de syntaxe `.gitignore` :**
- Nom seul → ignore ce fichier partout : `.env`
- `/` en fin → ignore tout le dossier : `node_modules/`
- `*` → joker : `*.log` ignore tous les fichiers `.log`
- `#` → commentaire, ligne ignorée par Git

**Premier commit :**
```bash
git add .gitignore
git commit -m "chore: ajout du .gitignore"
git push
```

**Convention Conventional Commits :** Les messages de commit suivent une convention standardisée. Le préfixe indique la nature du changement :
- `feat:` → nouvelle fonctionnalité
- `fix:` → correction de bug
- `docs:` → documentation
- `chore:` → tâche d'entretien (configuration, dépendances)
- `test:` → tests automatisés
- `refactor:` → refactorisation sans changement fonctionnel

---

## 4. Configuration de la base de données

### 4.1 Docker Compose — Orchestration de PostgreSQL

**Fichier :** `Veridian/docker-compose.yml`

**Définition de Docker Compose :** Outil permettant de définir et d'exécuter des applications multi-conteneurs via un fichier de configuration YAML. Dans Veridian, il orchestre un seul conteneur PostgreSQL avec l'extension pgvector.

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: veridian_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: veridian
      POSTGRES_USER: veridian_user
      POSTGRES_PASSWORD: veridian_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U veridian_user -d veridian"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

**Explication de chaque directive :**

- **`image: pgvector/pgvector:pg16`** : Image Docker officielle contenant PostgreSQL 16 avec l'extension pgvector préinstallée. Une image est un modèle pré-configuré et immuable servant de base à la création de conteneurs.

- **`container_name: veridian_db`** : Nom attribué au conteneur. Permet de le référencer par nom dans les commandes Docker (ex: `docker exec veridian_db ...`).

- **`restart: unless-stopped`** : Politique de redémarrage automatique. Le conteneur redémarre automatiquement après un crash ou un redémarrage du système, sauf s'il a été explicitement arrêté par l'utilisateur.

- **`environment:`** : Variables d'environnement injectées dans le conteneur au démarrage. PostgreSQL les lit pour se configurer automatiquement :
  - `POSTGRES_DB` : Nom de la base de données créée au premier démarrage
  - `POSTGRES_USER` : Nom de l'utilisateur PostgreSQL créé
  - `POSTGRES_PASSWORD` : Mot de passe de cet utilisateur

- **`ports: "5432:5432"`** : Mappage de ports au format `port_hôte:port_conteneur`. PostgreSQL écoute par convention sur le port 5432. Ce mappage rend le service accessible depuis la machine hôte sur le même port.

- **`volumes: postgres_data:/var/lib/postgresql/data`** : Montage d'un volume persistant. Sans cette directive, toutes les données seraient perdues à chaque arrêt du conteneur. Le volume `postgres_data` est géré par Docker et stocké sur le disque hôte, indépendamment du cycle de vie du conteneur.

- **`healthcheck:`** : Mécanisme de surveillance. Docker exécute périodiquement la commande `pg_isready` pour vérifier que PostgreSQL accepte des connexions. Un conteneur en état `healthy` garantit que la base de données est prête à recevoir des requêtes.

**Commandes essentielles :**
```bash
# Démarrer en arrière-plan
docker compose up -d

# Vérifier l'état des conteneurs
docker compose ps

# Consulter les logs
docker compose logs postgres

# Arrêter les conteneurs
docker compose down

# Arrêter et supprimer les volumes (réinitialisation complète)
docker compose down -v
```

**Test de connexion :**
```bash
docker exec veridian_db psql -U veridian_user -d veridian -c "SELECT version();"
```

Cette commande exécute une requête SQL à l'intérieur du conteneur pour vérifier que PostgreSQL répond correctement.

---

## 5. Initialisation du Backend Node.js

### 5.1 Le fichier `package.json`

**Définition :** `package.json` est le fichier de manifeste de tout projet Node.js. Il décrit le projet (nom, version, description), liste ses dépendances et définit les scripts d'exécution.

**Création :**
```bash
cd Projet/Backend
npm init -y
```

**`npm init -y`** : Initialise un projet Node.js en générant un `package.json` avec des valeurs par défaut. Le flag `-y` (yes) accepte automatiquement toutes les valeurs sans poser de questions.

**Configuration finale du `package.json` :**
```json
{
  "name": "veridian-backend",
  "version": "1.0.0",
  "description": "API backend pour Veridian",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "Francis Cote",
  "license": "ISC",
  "dependencies": {
    "express": "^5.2.1",
    "pg": "^8.22.0",
    "dotenv": "^17.4.2",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

**Explication des champs importants :**

- **`"type": "module"`** : Active la syntaxe ES Modules pour les imports. Permet d'utiliser `import ... from '...'` (syntaxe moderne) au lieu de `const ... = require('...')` (syntaxe CommonJS héritée). Ce choix est définitif pour un projet — tous les fichiers doivent utiliser la même syntaxe.

- **`"main": "server.js"`** : Point d'entrée principal du projet. Indique à Node.js quel fichier exécuter en premier.

- **`"scripts"`** : Raccourcis de commandes exécutables via `npm run <nom>` :
  - `"dev"` : Démarre le serveur avec nodemon (rechargement automatique) pour le développement
  - `"start"` : Démarre le serveur avec Node.js directement pour la production
  - `"test"` : Sera configuré ultérieurement pour exécuter les tests automatisés

- **`"dependencies"`** : Packages nécessaires en production. Installés avec `npm install <package>`.

- **`"devDependencies"`** : Packages nécessaires uniquement en développement. Installés avec `npm install --save-dev <package>`. Non installés lors d'un `npm install --production`.

**Le versioning sémantique (semver) :**
Le symbole `^` devant le numéro de version (ex: `^5.2.1`) signifie "compatible avec cette version mineure". npm peut mettre à jour vers `5.3.0` automatiquement, mais jamais vers `6.0.0` (changement majeur potentiellement incompatible). Le format est `MAJEUR.MINEUR.PATCH`.

### 5.2 Installation des dépendances

```bash
# Dépendances de production
npm install express pg dotenv bcryptjs jsonwebtoken

# Dépendance de développement uniquement
npm install --save-dev nodemon
```

**Rôle de chaque package :**

- **`express`** : Framework web minimaliste pour Node.js. Simplifie la création de serveurs HTTP et la gestion des routes, middlewares et réponses.
- **`pg`** : Client PostgreSQL pour Node.js (aussi appelé node-postgres). Gère les connexions et l'exécution des requêtes SQL.
- **`dotenv`** : Charge les variables d'environnement depuis un fichier `.env` local vers `process.env`.
- **`bcryptjs`** : Implémentation pure JavaScript de l'algorithme bcrypt pour le hachage sécurisé des mots de passe.
- **`jsonwebtoken`** : Génération et vérification de JSON Web Tokens pour l'authentification stateless.
- **`nodemon`** : Surveille les fichiers du projet et redémarre automatiquement le serveur Node.js à chaque modification. Utilisé uniquement en développement.

### 5.3 Nodemon — Rechargement automatique

**Problème résolu :** Sans nodemon, chaque modification de code nécessite d'arrêter manuellement le serveur (`Ctrl+C`) et de le relancer (`node server.js`). Ce cycle ralentit considérablement le développement.

**Fonctionnement :** Nodemon surveille les fichiers JavaScript du projet. Dès qu'un fichier est sauvegardé, il arrête et relance automatiquement le processus Node.js.

**Démarrage en mode développement :**
```bash
npm run dev
```

### 5.4 Le fichier `app.js`

**Rôle :** Initialise l'application Express, configure les middlewares globaux et définit les routes. Ce fichier représente la **configuration** du serveur, séparée de son démarrage.

**Raison de la séparation `app.js` / `server.js` :** Cette séparation est une bonne pratique architecturale fondamentale. Elle permet d'importer `app` dans les tests automatisés sans démarrer un vrai serveur réseau, rendant les tests plus rapides et isolés.

```javascript
import express from 'express';

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

export default app;
```

**Explication ligne par ligne :**

- **`import express from 'express'`** : Importe le module Express installé dans `node_modules`. La syntaxe `import ... from` est possible grâce au champ `"type": "module"` dans `package.json`.

- **`const app = express()`** : Instancie l'application Express. L'objet `app` est le noyau du serveur — il expose les méthodes pour définir des routes (`app.get`, `app.post`, etc.) et attacher des middlewares.

- **`app.get('/api/health', (req, res) => { ... })`** : Définit une route HTTP GET. Le premier argument est le chemin (endpoint), le second est une fonction callback exécutée à chaque requête correspondante.
  - `req` (Request) : Objet contenant toutes les informations de la requête entrante (headers, body, paramètres, etc.)
  - `res` (Response) : Objet exposant les méthodes pour construire et envoyer la réponse

- **`res.json({ status: 'ok' })`** : Sérialise l'objet JavaScript en JSON, définit le header `Content-Type: application/json` et envoie la réponse avec le code HTTP 200.

- **`export default app`** : Exporte l'objet `app` pour qu'il puisse être importé dans `server.js`. Avec ES Modules, chaque fichier doit explicitement exporter ce qu'il souhaite rendre disponible.

### 5.5 Le fichier `server.js`

**Rôle :** Point d'entrée de l'application. Importe la configuration depuis `app.js`, teste la connexion à la base de données, puis démarre l'écoute sur le port configuré.

```javascript
import 'dotenv/config';
import app from './app.js';
import { testConnection } from './src/config/db.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await testConnection();
  
  app.listen(PORT, () => {
    console.log(`🚀 Serveur Veridian démarré sur http://localhost:${PORT}`);
  });
};

startServer();
```

**Explication ligne par ligne :**

- **`import 'dotenv/config'`** : Forme condensée de `import dotenv from 'dotenv'; dotenv.config()`. Doit être la **première** importation du fichier pour garantir que toutes les variables d'environnement sont disponibles avant le chargement des autres modules.

- **`import app from './app.js'`** : Importe l'application Express configurée. Le chemin relatif `./` signifie "dans le même dossier".

- **`import { testConnection } from './src/config/db.js'`** : Importe uniquement la fonction nommée `testConnection` depuis le module de configuration de la base de données. Les accolades `{}` indiquent un import nommé (named export), par opposition à un import par défaut.

- **`process.env.PORT || 3000`** : Opérateur de court-circuit logique. Si `process.env.PORT` est défini (en production, la plateforme d'hébergement injecte souvent ce port), cette valeur est utilisée. Sinon, `3000` est la valeur par défaut pour le développement local.

- **`const startServer = async () => { ... }`** : Fonction asynchrone encapsulant le démarrage. L'`async` est nécessaire pour utiliser `await` à l'intérieur. Cette encapsulation permet une gestion structurée des erreurs de démarrage.

- **`await testConnection()`** : Attend la résolution de la promesse retournée par `testConnection()`. Si la connexion échoue, une exception est levée et le serveur ne démarre pas — comportement attendu (fail fast).

- **`app.listen(PORT, callback)`** : Démarre le serveur HTTP et le fait écouter sur le port spécifié. Le callback est exécuté une seule fois lorsque le serveur est prêt à accepter des connexions.

- **Template literal `` `...${PORT}...` ``** : Syntaxe moderne JavaScript pour l'interpolation de variables dans une chaîne. Plus lisible que la concaténation avec l'opérateur `+`.

---

## 6. Connexion à PostgreSQL

### 6.1 Variables d'environnement

**Fichier :** `Projet/Backend/.env`

```
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=veridian
DB_USER=veridian_user
DB_PASSWORD=veridian_pass

JWT_SECRET=veridian_secret_key_change_en_production
JWT_EXPIRES_IN=7d
```

**Principe fondamental :** Aucune information sensible (mot de passe, clé API, secret JWT) ne doit apparaître dans le code source. Ces valeurs sont externalisées dans le fichier `.env`, exclu du contrôle de version par `.gitignore`.

Ce principe garantit que :
- Le code source peut être partagé publiquement sans risque
- Les configurations diffèrent entre environnements (développement, test, production) sans modifier le code
- La rotation des clés (changement de mot de passe, renouvellement de clé API) ne nécessite pas de modification du code

### 6.2 Module de connexion à la base de données

**Fichier :** `Projet/Backend/src/config/db.js`

```javascript
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export const testConnection = async () => {
  const client = await pool.connect();
  await client.query('SELECT NOW()');
  client.release();
  console.log('✅ Connexion PostgreSQL établie');
};

export const query = (text, params) => pool.query(text, params);

export default pool;
```

**Concept de Pool de connexions :**

Un Pool de connexions est un mécanisme qui maintient un ensemble de connexions ouvertes et réutilisables à la base de données. Sans pool, chaque requête SQL nécessiterait :
1. Ouverture d'une nouvelle connexion (coûteuse en temps et ressources)
2. Exécution de la requête
3. Fermeture de la connexion

Avec un pool, les connexions sont créées à l'avance et réutilisées. Cela améliore significativement les performances sous charge.

**Explication ligne par ligne :**

- **`import pg from 'pg'`** : Importe le module node-postgres. L'objet `pg` expose plusieurs classes, dont `Pool`.

- **`dotenv.config()`** : Charge le fichier `.env` dans `process.env`. Cette fonction recherche le fichier `.env` dans le répertoire courant et ses parents.

- **`const { Pool } = pg`** : Déstructuration — extrait uniquement la classe `Pool` de l'objet `pg`. Équivalent à `const Pool = pg.Pool`.

- **`new Pool({ ... })`** : Instancie le pool avec les paramètres de connexion lus depuis les variables d'environnement. Le pool maintient par défaut jusqu'à 10 connexions simultanées.

- **`pool.connect()`** : Emprunte une connexion disponible du pool. Retourne une promesse — nécessite `await`. Si toutes les connexions sont occupées, attend qu'une se libère.

- **`client.query('SELECT NOW()')`** : Exécute une requête SQL triviale. `SELECT NOW()` retourne l'horodatage actuel du serveur PostgreSQL. Sert uniquement à vérifier que la connexion est opérationnelle.

- **`client.release()`** : **Critique.** Restitue la connexion empruntée au pool pour qu'elle soit réutilisable. L'oubli de cette instruction provoque une fuite de connexions — le pool s'épuise progressivement jusqu'à bloquer l'application.

- **`export const query = (text, params) => pool.query(text, params)`** : Fonction utilitaire qui abstrait l'accès au pool. Tous les modules du projet utiliseront cette fonction pour exécuter des requêtes SQL, sans avoir à importer le pool directement.

---

## 7. Schéma SQL — Modélisation de la base de données

**Fichier :** `Projet/Backend/database/schema.sql`

**Définition :** Le schéma SQL est la définition formelle de la structure de la base de données. Il spécifie les tables, colonnes, types de données, contraintes et index.

### 7.1 Extensions PostgreSQL

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
```

- **`CREATE EXTENSION IF NOT EXISTS`** : Installe une extension PostgreSQL si elle n'est pas déjà présente. La clause `IF NOT EXISTS` rend le script idempotent — il peut être exécuté plusieurs fois sans erreur.

- **`uuid-ossp`** : Active la fonction `uuid_generate_v4()` qui génère des UUID v4 (identifiants uniques universels basés sur l'aléatoire). Format : `550e8400-e29b-41d4-a716-446655440000`.

- **`vector`** : Extension pgvector — ajoute le type de données `vector(n)` et les algorithmes d'indexation vectorielle (IVFFlat, HNSW). Nécessaire pour la recherche sémantique par similarité.

### 7.2 Principe du Soft Delete

Veridian applique systématiquement le principe de **soft delete** (suppression douce) :

- Le code applicatif n'exécute **jamais** de requête `DELETE`
- La désactivation d'un enregistrement se fait par `UPDATE ... SET is_active = false`
- Les données restent en base, simplement marquées comme inactives
- Les suppressions physiques sont réservées aux opérations manuelles d'administration (purge de données de test, conformité réglementaire)

**Avantages :**
- Préservation de l'historique et de l'intégrité référentielle
- Possibilité de réactivation (`UPDATE ... SET is_active = true`)
- Traçabilité complète pour les audits
- Prévention des suppressions accidentelles en cascade

### 7.3 Tables et relations

#### Table `users`
```sql
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member')),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

| Colonne | Explication |
|---|---|
| `id UUID DEFAULT uuid_generate_v4()` | Clé primaire auto-générée. UUID préféré aux entiers séquentiels pour la sécurité et la distribution. |
| `email UNIQUE` | Contrainte d'unicité — crée automatiquement un index B-tree sur `email`. |
| `password_hash` | Jamais le mot de passe en clair. Stocke le résultat de l'algorithme bcrypt. |
| `role CHECK (role IN (...))` | Contrainte CHECK — PostgreSQL rejette toute valeur non listée au niveau de la base de données. |
| `is_active` | Soft delete — false = compte désactivé sans suppression physique. |
| `TIMESTAMPTZ` | Timestamp avec fuseau horaire (TimeZone). Recommandé sur `TIMESTAMP` pour les applications multi-fuseaux. |

#### Table `projects`
```sql
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'archived', 'inactive')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **`REFERENCES users(id) ON DELETE RESTRICT`** : Clé étrangère avec contrainte `RESTRICT` — PostgreSQL refuse la suppression d'un utilisateur propriétaire de projets. Cohérent avec le principe soft delete.
- **`description TEXT`** : Type `TEXT` sans limite de longueur, contrairement à `VARCHAR(n)`. Adapté aux descriptions potentiellement longues.

#### Table `project_members`
```sql
CREATE TABLE IF NOT EXISTS project_members (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  role        VARCHAR(20) NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'member')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);
```

- **Clé primaire composite `PRIMARY KEY (user_id, project_id)`** : Garantit qu'un utilisateur ne peut être membre qu'une seule fois par projet. Pattern standard pour les tables de jonction modélisant les relations N à N.
- **Table de jonction** : Un utilisateur peut appartenir à plusieurs projets, un projet peut avoir plusieurs membres. Cette relation plusieurs-à-plusieurs nécessite une table intermédiaire.

#### Table `meetings`
```sql
CREATE TABLE IF NOT EXISTS meetings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned', 'active', 'processing', 'done', 'cancelled')),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  audio_path  VARCHAR(500),
  started_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **Machine à états** : Le champ `status` définit les états possibles d'une réunion et leur progression logique : `planned → active → processing → done`. Les transitions sont validées côté applicatif.
- **`audio_path` nullable** : Vide lors de la création, rempli après l'upload du fichier audio.
- **`started_at / ended_at` nullables** : Permettent le calcul de la durée effective de la réunion.

#### Table `participants`
```sql
CREATE TABLE IF NOT EXISTS participants (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id   UUID NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  user_id      UUID REFERENCES users(id) ON DELETE RESTRICT,
  display_name VARCHAR(100) NOT NULL,
  role         VARCHAR(20) NOT NULL DEFAULT 'attendee'
               CHECK (role IN ('host', 'attendee')),
  is_active    BOOLEAN NOT NULL DEFAULT true,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **`user_id` nullable** : Un participant peut être un utilisateur enregistré (`user_id` rempli) ou un invité externe sans compte Veridian (`user_id = NULL`). La contrainte `REFERENCES` est vérifiée uniquement pour les valeurs non-NULL.

#### Table `transcriptions`
```sql
CREATE TABLE IF NOT EXISTS transcriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id  UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE RESTRICT,
  raw_text    TEXT NOT NULL,
  language    VARCHAR(10) NOT NULL DEFAULT 'fr',
  is_edited   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **`meeting_id UNIQUE`** : Contrainte d'unicité sur la clé étrangère — implémente une relation 1 à 1 stricte entre `meetings` et `transcriptions`.
- **`is_edited`** : Distingue les transcriptions brutes (Whisper) des transcriptions corrigées manuellement par un utilisateur.

#### Table `decisions`
```sql
CREATE TABLE IF NOT EXISTS decisions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meeting_id    UUID NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  content       TEXT NOT NULL,
  context       TEXT,
  responsible   VARCHAR(150),
  alternatives  TEXT[],
  confidence    INTEGER NOT NULL DEFAULT 100
                CHECK (confidence BETWEEN 0 AND 100),
  status        VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('draft', 'confirmed', 'contradicted', 'inactive')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **Double référence `meeting_id` + `project_id`** : Optimisation de requêtes. Permet de récupérer toutes les décisions d'un projet sans jointure supplémentaire sur `meetings`.
- **`alternatives TEXT[]`** : Type tableau PostgreSQL. Stocke une liste de chaînes de caractères dans une seule colonne. Ex: `{"Vue.js", "Angular", "Svelte"}`.
- **`confidence BETWEEN 0 AND 100`** : Niveau de certitude de l'extraction IA. Permet de filtrer ou prioriser les décisions selon leur fiabilité.

#### Table `memory_chunks`
```sql
CREATE TABLE IF NOT EXISTS memory_chunks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  decision_id  UUID NOT NULL REFERENCES decisions(id) ON DELETE RESTRICT,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  content      TEXT NOT NULL,
  embedding    vector(1536),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_chunks_embedding
  ON memory_chunks USING hnsw (embedding vector_cosine_ops);
```

- **`embedding vector(1536)`** : Vecteur dense de 1536 dimensions, format natif du modèle `text-embedding-3-small` d'OpenAI. Nullable — généré asynchronement après la création.
- **Index HNSW** : Hierarchical Navigable Small World — algorithme de recherche approximative du plus proche voisin (ANN). Complexité O(log n) vs O(n) pour un scan séquentiel. `vector_cosine_ops` utilise la similarité cosinus comme métrique.

#### Table `alerts`
```sql
CREATE TABLE IF NOT EXISTS alerts (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  new_decision_id      UUID NOT NULL REFERENCES decisions(id) ON DELETE RESTRICT,
  conflict_decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE RESTRICT,
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  explanation          TEXT NOT NULL,
  severity             VARCHAR(10) NOT NULL DEFAULT 'medium'
                       CHECK (severity IN ('low', 'medium', 'high')),
  is_active            BOOLEAN NOT NULL DEFAULT true,
  resolved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- **Double référence vers `decisions`** : `new_decision_id` et `conflict_decision_id` référencent la même table — relation réflexive valide en modélisation relationnelle.
- **`resolved_at` nullable** : Pattern timestamp-as-boolean. `NULL` = alerte active. Valeur = alerte résolue à cet horodatage précis. Plus informatif qu'un simple booléen.

### 7.4 Index de performance

```sql
CREATE INDEX IF NOT EXISTS idx_meetings_project_id   ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_project_id  ON decisions(project_id);
CREATE INDEX IF NOT EXISTS idx_decisions_meeting_id  ON decisions(meeting_id);
CREATE INDEX IF NOT EXISTS idx_alerts_project_id     ON alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_memory_chunks_project ON memory_chunks(project_id);
```

**Définition :** Un index est une structure de données auxiliaire qui accélère la recherche de lignes selon des critères spécifiques. Sans index, PostgreSQL effectue un parcours séquentiel (full table scan) — il examine chaque ligne une par une.

**Choix des colonnes indexées :** Les index sont créés sur les colonnes fréquemment utilisées dans les clauses `WHERE` et les jointures. Dans Veridian, `project_id` et `meeting_id` sont les filtres les plus fréquents.

**Exécution du schéma :**
```bash
docker exec -i veridian_db psql -U veridian_user -d veridian \
  < Projet/Backend/database/schema.sql
```

**Vérification :**
```bash
# Lister les tables
docker exec -it veridian_db psql -U veridian_user -d veridian -c "\dt"

# Lister les extensions
docker exec -it veridian_db psql -U veridian_user -d veridian -c "\dx"

# Lister les index
docker exec -it veridian_db psql -U veridian_user -d veridian -c "\di"
```

---

## 8. Utilitaires de sécurité

### 8.1 Hachage des mots de passe

**Fichier :** `Projet/Backend/src/utils/hash.utils.js`

```javascript
import bcrypt from 'bcryptjs';

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};
```

**Algorithme bcrypt :**
Bcrypt est un algorithme de hachage de mots de passe conçu par Niels Provos et David Mazières en 1999, basé sur le chiffrement Blowfish. Ses caractéristiques le rendent particulièrement adapté au stockage de mots de passe :

1. **Salt intégré** : Un sel cryptographique aléatoire est généré et incorporé au hash. Deux hachages du même mot de passe produiront des résultats différents.

2. **Facteur de coût adaptatif** : Le paramètre de rounds (10 dans Veridian) détermine le nombre d'itérations (2¹⁰ = 1024). Ce facteur peut être augmenté à mesure que la puissance de calcul augmente.

3. **Irréversibilité** : Il est computationnellement impossible de retrouver le mot de passe original à partir du hash.

**`bcrypt.genSalt(10)`** : Génère un sel cryptographique aléatoire de 128 bits avec un facteur de coût de 10. Le sel est une valeur unique ajoutée au mot de passe avant hachage — il neutralise les attaques par rainbow tables (dictionnaires de hashes précalculés).

**`bcrypt.hash(password, salt)`** : Combine le mot de passe et le sel, applique l'algorithme 2¹⁰ fois, et retourne une chaîne de 60 caractères encodant l'algorithme, le facteur de coût, le sel et le hash.

**`bcrypt.compare(password, hash)`** : Extrait le sel depuis le hash stocké, rehashe le mot de passe fourni avec ce sel, et compare les résultats. La comparaison est toujours unidirectionnelle — le hash n'est jamais déchiffré.

### 8.2 JSON Web Tokens (JWT)

**Fichier :** `Projet/Backend/src/utils/jwt.utils.js`

```javascript
import jwt from 'jsonwebtoken';

export const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};
```

**Standard JWT (RFC 7519) :**
Un JSON Web Token est une chaîne compacte et auto-suffisante encodant des informations (claims) de manière sécurisée. Structure en trois segments Base64URL séparés par des points :

```
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEyMyIsInJvbGUiOiJtZW1iZXIifQ.abc123xyz
       HEADER                          PAYLOAD                    SIGNATURE
```

- **Header** : Algorithme de signature (`{"alg": "HS256", "typ": "JWT"}`)
- **Payload** : Données encodées (`{"id": "123", "role": "member", "exp": 1234567890}`)
- **Signature** : HMAC-SHA256 du header et du payload avec `JWT_SECRET`

**Architecture stateless :**
Contrairement aux sessions côté serveur (qui nécessitent un stockage partagé entre instances), les JWT sont auto-suffisants. Le serveur vérifie uniquement la signature — il n'a pas besoin de consulter une base de données pour chaque requête. Cela facilite la scalabilité horizontale.

**`jwt.sign(payload, secret, options)`** : Génère un token signé. Le payload est encodé (Base64URL) mais non chiffré — il est lisible par décodage. Ne jamais y inclure de données sensibles (mot de passe, numéro de carte de crédit).

**`jwt.verify(token, secret)`** : Valide l'authenticité (signature HMAC) et la validité temporelle (expiration). Lève `JsonWebTokenError` si la signature est invalide, `TokenExpiredError` si le token est expiré.

---

*Guide de développement Veridian — INF4018 — Francis Côté*