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
9. [Décisions de conception par bloc](#9-décisions-de-conception-par-bloc)

---

## 1. Présentation du projet

### 1.1 Problématique

Les équipes en entreprise prennent leurs décisions importantes lors de réunions. Or, ces décisions ne sont jamais formellement documentées, archivées ni reliées les unes aux autres. Les comptes rendus manuels sont partiels, subjectifs et rarement consultés. Lorsqu'une équipe souhaite retrouver pourquoi elle a pris une décision plusieurs semaines auparavant, l'information est perdue ou éparpillée dans des fils de courriels et des notes personnelles.

Les outils actuels de transcription automatique, tels qu'Otter.ai et Fireflies.ai, se limitent à produire des transcriptions textuelles et des résumés généraux, sans aucune capacité de mémoire organisationnelle structurée ni de détection de contradictions entre décisions successives.

### 1.2 Solution — Veridian

Veridian est une application web complète qui permet aux équipes d'entreprise de :

- Enregistrer automatiquement les réunions directement depuis le navigateur
- Transcrire l'audio avec Whisper, exécuté localement (aucune donnée envoyée à un service externe)
- Extraire les décisions, les tâches et les acteurs avec l'API Google Gemini
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
- **Backend (Node.js/Express)** : Serveur API REST qui traite les requêtes du frontend, lance Whisper en local, appelle l'API Gemini et gère la base de données.
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
- **`.env`** : Contient la clé API Gemini, le secret JWT, les identifiants SMTP et les mots de passe de base de données. Si ce fichier est commité sur GitHub, ces informations sensibles sont exposées publiquement. C'est la règle de sécurité la plus importante du projet.
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

## 9. Décisions de conception par bloc

Cette section explique, bloc par bloc, les choix faits et leur justification. Les bugs rencontrés sont détaillés dans `journal_bugs.md`.

### 9.1 Hygiène du dépôt (avant le bloc 12)

- **`.gitattributes` plutôt que `core.autocrlf`.** `core.autocrlf` est un réglage de chaque poste : deux machines configurées différemment produisent de faux fichiers modifiés. Un `.gitattributes` est versionné, donc la même règle s'applique partout : texte en LF, scripts Windows (`.bat`, `.cmd`, `.ps1`) en CRLF, binaires sans conversion.
- **Renormalisation ciblée.** Seuls quatre fichiers étaient stockés en CRLF. Ils ont été renormalisés en les nommant un par un (`git add --renormalize -- <fichiers>`), dans un commit séparé de la règle. Un `git add --renormalize .` aurait aussi pris des fichiers modifiés sans rapport.
- **`npm test` portable.** Le script appelle `node_modules/jest/bin/jest.js`, le vrai fichier JavaScript de Jest, plutôt que le raccourci `node_modules/.bin/jest`, qui dépend du système.

### 9.2 Bloc 12 — Frontend branché à l'API

- **Deux clients HTTP, deux rôles.** `api/client.js` sert à la connexion et à l'inscription : un 401 y signifie « mauvais mot de passe » et s'affiche dans le formulaire. `services/api.js` sert aux pages protégées : un 401 y signifie « jeton expiré ou invalide ». Le client efface alors le jeton, range un message dans `sessionStorage` et renvoie vers `/login`, où le composant `SessionNotice` l'affiche une seule fois. `sessionStorage` disparaît à la fermeture de l'onglet : un vieux message ne réapparaît pas.
- **URL relatives (`/api/...`).** Le proxy de Vite (`vite.config.js`) transmet `/api` au backend. Le navigateur ne voit qu'une origine (`localhost:5173`), il n'y a donc pas de requête cross-origin et le frontend ne dépend plus d'une adresse de backend codée en dur.
- **Envoi de fichiers.** Avec un `FormData`, le client ne fixe **pas** `Content-Type` : le navigateur doit l'écrire lui-même avec la « boundary » qui sépare les parties du multipart. Le fixer à la main casse l'envoi.
- **Une seule source pour les statuts.** `utils/labels.js` reprend exactement les valeurs permises par les contraintes `CHECK` de la base (`planned`, `processing`, `done`...). Avant, chaque page avait sa propre liste, et celle de la page Réunions utilisait des valeurs inexistantes.
- **Fonctions pures testées sans dépendance.** Les calculs de dates (`utils/dates.js`) ne dépendent pas de React. Ils sont testés avec le testeur intégré à Node (`node --test`, script `npm test` du frontend), ce qui évite d'ajouter un outil de test au projet. L'heure courante est un paramètre (`now`), pour que les tests ne dépendent pas du moment où ils tournent.
- **Échéances lues en UTC.** Le backend fixe une date sans heure à 17 h UTC (BUG-03). Le frontend l'affiche donc avec `timeZone: 'UTC'`, ce qui garde le bon jour quel que soit le fuseau du navigateur.
- **Vérifier les variables CSS.** Une variable inexistante ne produit aucune erreur. Cette commande (Git Bash, depuis `Projet/Frontend`) liste les `var(--…)` utilisées dans `src` mais absentes d'`index.css` ; seules celles de l'ancien `App.css`, qui n'est plus importé, doivent rester :

  ```bash
  for v in $(grep -rhoE "var\(--[a-z0-9-]+" src | sed 's/var(//' | sort -u); do grep -q -- "$v:" src/index.css || echo "$v"; done
  ```
- **Pastilles d'état réelles.** `GET /api/health` renvoie `services.ai` (une clé Gemini est-elle configurée ?) et `services.email` (`smtp` ou `console`). Ce sont des indicateurs, jamais des secrets. L'en-tête affiche « IA non configurée » ou « Courriels simulés » au lieu d'une pastille « IA active » codée en dur.


### 9.3 Bloc 13 — Formulaires et membres

- **Ajouter un membre par courriel exact, sans route de recherche.** Une route `GET /api/users?search=` permettrait de parcourir la liste des comptes. L'ajout se fait plutôt avec le courriel **complet** d'un compte existant (`POST /api/projects/:id/members`), et seul le propriétaire du projet peut le faire. La réponse ne contient jamais `password_hash`.
- **404 ou 403 ?** Une personne qui n'est pas membre d'un projet reçoit toujours 404, comme si le projet n'existait pas : on ne lui révèle rien. Un membre qui tente une action réservée au propriétaire (ajouter ou retirer un membre, supprimer la tâche d'un autre) reçoit 403 : il connaît déjà le projet, donc le 403 ne révèle rien de plus et lui explique pourquoi l'action est refusée. C'est la même règle que la modification d'un projet (bloc 03).
- **Réactiver plutôt que dupliquer.** La clé primaire de `project_members` est `(user_id, project_id)`. Comme un membre retiré garde sa ligne (`is_active = false`), le réajouter avec un simple `INSERT` violerait la clé. On utilise `INSERT … ON CONFLICT DO UPDATE SET is_active = true WHERE project_members.is_active = false` : une seule requête crée ou réactive la ligne. Si rien n'est renvoyé, la personne était déjà membre (409).
- **L'acteur d'une tâche est un membre du projet.** Le serveur vérifie `isActiveMember` à la création et à la modification (400 sinon). Le formulaire ne propose de toute façon que les membres du projet choisi. Les deux contrôles sont nécessaires : le second guide l'utilisateur, le premier protège contre un appel direct à l'API.
- **Modification partielle sans injection SQL.** `PUT /api/tasks/:id` ne modifie que les champs envoyés. La requête est construite à partir d'une **liste fixe** de colonnes autorisées ; les valeurs passent toutes par des paramètres `$1, $2…`. Aucun texte venant de la requête n'est collé dans le SQL.
- **Suppression logique des tâches.** Comme pour les autres tables, une tâche supprimée garde sa ligne (`is_active = false`, migration 011). L'historique reste disponible pour l'analyse des risques et le rapport.
- **Validation à deux niveaux.** `Frontend/src/utils/validation.js` reprend les limites du serveur (`Backend/src/utils/validation.utils.js`) : 150 caractères pour un nom de projet, 200 pour un titre, 2000 pour une description. Le client affiche l'erreur à côté du champ sans appel réseau, et le serveur reste la vraie protection.
- **Formulaires accessibles.** Chaque champ a une étiquette reliée (`htmlFor`/`id`), et les erreurs sont annoncées (`role="alert"`). La fenêtre de dialogue se ferme avec Échap et place le focus sur le premier champ.
- **Tests sur vraie base.** `tests/integration/formulaires.it.mjs` traverse les vraies routes (`supertest`) avec PostgreSQL : il vérifie les codes d'accès (404 pour un externe, 403 pour un membre non propriétaire), la réactivation d'un membre et la suppression logique.


### 9.4 Bloc 14 — Page de détail d'une réunion

- **Une route agrégée.** `GET /api/meetings/:id/details` fait **une** vérification d'appartenance, puis lance six requêtes indépendantes en parallèle (`Promise.all`) : transcription, décisions, tâches, contradictions, risques, courriels. Appeler six routes depuis la page aurait demandé six allers-retours et six vérifications d'accès.
- **Toutes les tâches de la réunion.** La page montre les tâches extraites par l'analyse **et** celles ajoutées à la main (`meeting_id`), sauf les tâches supprimées. `GET /api/meetings/:id/analysis` (bloc 19) ne montre que le résultat de l'analyse.
- **Contradictions dans les deux sens.** Une alerte s'affiche sur la réunion de la nouvelle décision **et** sur celle de la décision contredite (`nd.meeting_id = $1 OR cd.meeting_id = $1`).
- **Audio protégé.** Une balise `<audio src="/api/...">` ne peut pas envoyer l'en-tête `Authorization`. Rendre la route publique permettrait à quiconque connaît l'adresse d'écouter la réunion. La page télécharge donc le fichier avec le jeton (`api.blob`), crée une adresse locale (`URL.createObjectURL`) et la libère en quittant la page (`URL.revokeObjectURL`). Le serveur répond avec `res.sendFile`, qui gère l'en-tête `Range` (réponse 206) : le lecteur peut avancer sans tout retélécharger.
- **Chemin de fichier sûr.** Seul le **nom** du fichier est gardé en base. `resolveAudioPath` refuse un nom qui contient un dossier (`../`), un chemin absolu, ou qui sortirait du dossier d'envoi. Même une base modifiée ne permettrait pas de lire `.env`. Le client ne reçoit jamais ce nom, seulement `has_audio`.
- **Transcription modifiable.** La correction passe par `PUT /api/transcriptions/:id` (bloc 05), qui ré-indexe la mémoire. La page affiche le résultat réel de cette ré-indexation : un échec (clé invalide, quota) est montré, pas caché.


### 9.5 Bloc 20 — Enregistrer une réunion

- **Traitement en arrière-plan.** Une transcription Whisper sur processeur dure à peu près la durée de l'enregistrement. L'envoi répond donc `202 Accepted` (« reçu, traitement en cours ») dès que le fichier est enregistré. Le traitement (`transcribeMeetingAudioSafely`) est lancé **sans `await`** : la requête se termine, le travail continue dans le processus Node. La variante `…Safely` ne lance jamais d'erreur, ce qui évite une promesse rejetée que personne n'attend ; l'échec est enregistré en base.
- **Un état consultable.** `meetings.transcription_status` (`none`, `processing`, `done`, `error`) et son message (migration 012) s'ajoutent à `analysis_status` (bloc 19). La page interroge `GET /api/meetings/:id/analysis` toutes les 3 s tant qu'un traitement est en cours. Elle utilise un `setTimeout` relancé après chaque réponse, et non un `setInterval` : si le serveur est lent, les requêtes ne s'empilent pas.
- **Redémarrage pendant un traitement.** Le travail vivait dans le processus arrêté : il est perdu. Au démarrage, `resetInterruptedProcessing` passe ces réunions en `error` (« Le serveur a redémarré pendant le traitement. Relancez-le. »). Sinon, elles resteraient « en cours » pour toujours. Une file de travaux persistante (par exemple une table de tâches relue au démarrage) serait l'étape suivante, mais elle n'est pas nécessaire pour un seul serveur.
- **Un seul traitement à la fois par réunion.** Un nouvel envoi pendant une transcription en cours reçoit 409 : deux Whisper sur la même réunion écriraient la même transcription en concurrence.
- **Audio adopté seulement en cas de succès.** Le nouvel enregistrement ne remplace l'ancien qu'après une transcription réussie. En cas d'échec, l'ancien audio et l'ancienne transcription restent cohérents entre eux.
- **Enregistrement dans le navigateur.** `getUserMedia({ audio: true })` donne le flux du micro, et `MediaRecorder` l'encode. Le format est choisi avec `MediaRecorder.isTypeSupported` (`audio/webm;codecs=opus` pour Chrome, Edge et Firefox, `audio/mp4` pour Safari). `recorder.start(1000)` remet les données chaque seconde, ce qui évite de tout perdre si un problème survient en cours de route. Le micro est libéré (`track.stop()`) à l'arrêt et en quittant la page. Un indicateur de niveau (`AnalyserNode`) montre que le micro capte bien quelque chose.
- **`getUserMedia` exige une origine sécurisée** (`https://` ou `http://localhost`). L'application tourne sur `http://localhost:5173`, ce qui convient. Ouverte par l'adresse IP du poste (`http://192.168…`), elle ne pourrait pas enregistrer ; la page l'explique au lieu d'échouer en silence.
- **Envoi avec progression.** `fetch` ne mesure pas la progression d'un **envoi**, alors que `XMLHttpRequest` le fait (`xhr.upload.onprogress`) : d'où `uploadWithProgress`. Si la connexion est perdue, l'enregistrement reste en mémoire dans la page, avec un bouton « Réessayer l'envoi ».
- **Extension tirée du type vérifié.** Le serveur nomme le fichier `audio_<horodatage>_<16 caractères aléatoires>.<extension du type>`. Le nom choisi par l'utilisateur n'est jamais utilisé : on ne peut ni deviner l'adresse d'un autre enregistrement ni déposer un fichier `.html`.
- **Whisper : erreurs actionnables.** ffmpeg est vérifié avant Whisper ; s'il manque, le message donne la commande d'installation. `WHISPER_COMMAND` et `FFMPEG_COMMAND` permettent d'indiquer un chemin complet. Le délai maximal (`WHISPER_TIMEOUT_MIN`) arrête un traitement bloqué. Le fichier JSON temporaire est supprimé dans un `finally`, donc dans tous les cas.
- **Silence et phrases inventées.** Sur du silence, Whisper produit des phrases de sous-titres (« Merci. », « Thank you. »). Une transcription entière réduite à l'une d'elles est traitée comme « aucune parole » (BUG-24).
- **Vérification réelle.** `tests/integration/enregistrement.it.mjs` utilise le vrai ffmpeg et le vrai Whisper (seul Gemini est remplacé). Avec un fichier et un mot attendu en arguments, il vérifie aussi le contenu transcrit.


### 9.6 Bloc 21 — Résultats de l'analyse, Mes tâches, tableau de bord

- **Projet nouveau ou existant.** La migration 013 ajoute `projects.source_meeting_id`, rempli quand l'analyse crée un projet. On ne déduit rien de la description par défaut, que l'utilisateur peut modifier. Si l'analyse est relancée, l'IA retrouve ce projet comme « existant » et ne le recrée pas, mais la page l'affiche toujours « nouveau, créé par cette réunion ».
- **Ne pas révéler un projet inaccessible.** La liste des projets d'une réunion est limitée à ceux dont l'utilisateur est membre. Une personne retirée d'un projet créé par la réunion n'en voit plus le nom.
- **Suivi en direct partagé.** L'état du traitement est détenu par `MeetingView` et transmis à la section Enregistrement et à la section Analyse. Le bouton « Relancer l'analyse » met l'état à `processing`, et le même suivi (toutes les 3 s) prend le relais. Les hooks React ne pouvant pas être appelés après un `return` conditionnel (« Chargement… »), ce rendu est un sous-composant affiché une fois les données chargées.
- **État écrit avant de répondre.** Un travail lancé en arrière-plan doit avoir son état « en cours » enregistré **avant** la réponse HTTP (BUG-28). Sinon, le client peut lire un état périmé et arrêter le suivi.
- **Tâches regroupées par acteur.** `groupByActor` crée un groupe par compte. Un nom cité dans la réunion mais sans compte membre du projet forme son propre groupe, marqué « non lié à un compte » : l'analyse ne donne jamais accès à un projet existant (bloc 19).
- **Mes tâches.** Le filtre « Acteur : Moi » est appliqué par défaut. Le tri par échéance place les tâches sans échéance puis les tâches terminées à la fin. Le statut se change par un menu (à faire, en cours, terminée), plus clair qu'une case à cocher à deux états. Filtres et tri sont des fonctions pures (`utils/tasks.js`), testées sans navigateur.
- **Compteurs calculés en SQL.** `GET /api/dashboard` compte en base (tâches ouvertes, en retard, alertes ouvertes, réunions du mois) au lieu de télécharger toutes les listes pour les compter dans le navigateur. « En retard » a la même définition côté serveur (`date UTC de l'échéance < date UTC du jour`) et côté client (`isOverdue`), sinon le compteur et la liste ne seraient pas d'accord. `COUNT(*)` renvoie un `bigint`, que le pilote `pg` transmet sous forme de texte : on le convertit en nombre.
- **Une échéance passée n'est pas acceptée de l'IA.** L'analyse remplace une date déjà passée par une date estimée selon la priorité (`resolveDueDate`, bloc 19) : une tâche qui vient d'être créée ne peut pas déjà être en retard.

### 9.7 Bloc 16 — Calendrier de projet

- **Une date prévue pour la réunion.** Sans elle, le calendrier ne pourrait montrer que la date de création, ce qui ne sert pas à planifier. La migration 014 ajoute `meetings.scheduled_at` (facultative). Le calendrier place une réunion à sa date prévue, sinon à son début réel (`started_at`), sinon à sa création : `COALESCE(scheduled_at, started_at, created_at)`.
- **L'heure saisie est locale, l'instant enregistré est UTC.** Le champ `datetime-local` donne une heure sans fuseau (« AAAA-MM-JJTHH:MM »). Le navigateur, qui connaît le fuseau de l'utilisateur, la convertit en instant ISO (`toISOString()`) avant l'envoi. Le serveur n'a jamais à deviner un fuseau.
- **Deux règles de jour.** Une réunion est un **instant** : elle est placée dans le jour **local**. Une échéance de tâche est un **jour** (fixé à 17 h UTC, BUG-03) : elle est placée selon son jour **UTC**. Sinon, une tâche du 5 pourrait apparaître le 4 ou le 6 selon le fuseau.
- **Plage élargie côté serveur.** Le serveur ne connaît pas le fuseau du navigateur. Pour les réunions, il élargit donc la plage demandée d'un jour de chaque côté, et le frontend ne garde que ce qui tombe dans sa grille. Pour les tâches, la plage est exacte, bornes incluses (jour UTC).
- **Une route dédiée plutôt que les listes existantes.** `GET /api/calendar?from&to&projectId` ne renvoie que la plage affichée (au plus 92 jours, 400 au-delà), au lieu de télécharger toutes les réunions et toutes les tâches. Le contrôle d'accès est fait dans la requête SQL (membre actif du projet, même règle de visibilité des tâches que `task.model.js`). Avec `projectId`, l'appartenance est vérifiée **avant** toute lecture (404 sinon).
- **Grille fixe de 42 cases.** Six semaines, du lundi au dimanche (usage au Québec), quel que soit le mois : la hauteur de la page ne change pas d'un mois à l'autre. Les dates locales sont créées à **midi** : un changement d'heure (été/hiver) ne fait jamais glisser un jour sur le précédent. Les tests passent dans quatre fuseaux (`TZ=America/Toronto`, `Asia/Tokyo`, `Pacific/Honolulu`, UTC).
- **État dans l'URL.** Le mois, le projet et le filtre « mes tâches » sont dans l'adresse (`?mois=AAAA-MM&projet=…&miennes=1`) : un lien « Voir le calendrier du projet » est possible, et le bouton Précédent du navigateur fonctionne.
- **Accessibilité.** La grille suit le modèle « grid » de WAI-ARIA : un tableau `role="grid"`, une seule case atteignable par Tab (tabindex itinérant), les flèches changent de jour, Début/Fin vont au début/à la fin de la semaine, Page préc./suiv. change de mois. Chaque case a une étiquette lisible (nom du jour, date complète et nombre d'événements). Les couleurs sont doublées d'une légende et du libellé dans la liste du jour : l'information ne repose jamais sur la couleur seule.
- **« Chargement » dérivé, pas stocké.** La page garde le résultat de la dernière requête avec sa clé (plage + projet). Elle est « en chargement » quand cette clé diffère de celle demandée. On évite ainsi un `setState` synchrone dans un effet, et une réponse arrivée après un changement de mois est ignorée.

### 9.8 Bloc 17 — Tests d'intégration et sécurité

**Tests**

- **Deux familles de tests, deux projets Jest.** Les tests `unit` simulent la base et l'IA : rapides, sans dépendance, ils tournent sur un clone neuf (`npm test`). Les tests `api` passent par les vraies routes HTTP (supertest) sur une vraie base. Seule l'IA y est simulée, parce qu'elle coûte, varie d'une fois à l'autre et dépend du réseau. Les mocks ne voient pas les erreurs SQL : c'est ce qui justifie la seconde famille (BUG-02).
- **Une base de test jetable.** `preparer-base-test.mjs` supprime et recrée `veridian_test` avant chaque exécution, puis applique le schéma et **toutes** les migrations, comme les scripts de démarrage. Chaque exécution part donc du même état, et une migration cassée fait échouer les tests. Le nom doit finir par `_test` : une faute de frappe ne peut pas effacer la base de développement. Les variables du test (base, SMTP vide, clé factice) sont posées **avant** l'import de l'application, et `dotenv` ne remplace jamais une variable déjà définie.
- **Une IA simulée mais réaliste.** Les réponses dépendent du type de requête (analyse, contradiction, risques, chat). Les embeddings sont des vecteurs calculés à partir des mots du texte : la recherche pgvector (`<=>`) trouve vraiment les extraits proches. Le chat et la mémoire sont donc testés de bout en bout.
- **Le contrôle d'accès testé route par route.** Un utilisateur B, non membre, essaie toutes les lectures et écritures sur le projet de A. Le test vérifie la réponse (404, jamais 403) **et** l'état de la base après coup : rien n'a changé.
- **Couverture : environ 92 % des lignes** (unitaires + API), au-delà de l'objectif de 60 %. Rapport HTML : `coverage/index.html`.

**Sécurité**

- **En-têtes (`helmet`).** `nosniff`, interdiction d'afficher l'API dans un cadre, retrait de `X-Powered-By`. La politique `Cross-Origin-Resource-Policy` est `same-site`, pour que le frontend (port 5173) puisse lire l'audio et le PDF du backend (port 3000).
- **CORS configurable.** `FRONTEND_URL` liste les origines permises. L'en-tête `Access-Control-Allow-Origin` n'est renvoyé qu'à une origine connue ; une pré-vérification d'une autre origine reçoit 403. Le CORS ne protège que contre un **navigateur** piloté par un autre site. L'authentification reste la vraie protection.
- **Limitation de débit** sur `/api/auth/login` et `/api/auth/register` (20 essais / 15 min / IP par défaut), placée **avant** la lecture du corps de la requête. En développement, toutes les requêtes passent par le proxy de Vite et partagent donc la même adresse : la limite est assez large pour ne pas gêner.
- **Inscription validée côté serveur.** Courriel valide et enregistré en minuscules, nom de 100 caractères au plus, mot de passe de 8 caractères au moins. Le maximum est de 72 **octets**, parce que bcrypt ignore silencieusement la suite. La validation du navigateur (`minLength`) se contourne en appelant l'API directement.
- **Connexion qui ne révèle rien.** Même message et même code (401) pour un courriel inconnu et un mauvais mot de passe. Pour un courriel inconnu, le serveur fait quand même une comparaison bcrypt (empreinte factice), donc la durée de la réponse ne trahit pas l'existence d'un compte. « Compte désactivé » (403) n'est dit qu'après un mot de passe correct.
- **JWT.** L'algorithme HS256 est imposé à la signature et à la vérification (refus de `alg: none` et des jetons signés avec une autre clé). Le serveur refuse de démarrer si `JWT_SECRET` est vide ou fait moins de 32 caractères. Les scripts de démarrage en génèrent un de 64.
- **SQL.** Toutes les valeurs sont passées en paramètres (`$1`, `$2`…). Les seules parties assemblées sont des fragments constants du code (sous-requêtes partagées, liste blanche de colonnes). Un identifiant mal formé donne 400 : validation explicite dans chaque contrôleur, plus un filet de sécurité (`22P02` → 400) dans le gestionnaire d'erreurs.
- **Erreurs.** Le client ne reçoit jamais le message interne (SQL, chemin de fichier) ni la trace d'exécution, sauf avec `NODE_ENV=development`. La trace complète reste dans la console du serveur.
- **Déjà en place et vérifiés par les tests** : échappement HTML des courriels (`escapeHtml`), aucune route ne renvoie `password_hash`, type et taille des fichiers audio contrôlés, chemin du fichier audio jamais exposé.

---

*Guide de développement Veridian — INF4018 — Francis Côté*