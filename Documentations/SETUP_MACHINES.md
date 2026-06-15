# Guide de setup — Environnement de développement Veridian
## Compatible Windows 10/11 et Ubuntu 22.04/24.04
## Ce Guide n'est pas complet pour le moment et il est non fonctionnel t'en que le projet ne sera pas commencer en DEV
## Seulement l'installation des logiciel nécessaire peut être fait.


---

## 1. Git pour le local, sinon le projet est sur github

### Windows
1. Télécharger Git depuis https://git-scm.com/download/win
2. Installer avec les options par défaut
3. Vérifier : `git --version`

### Ubuntu
```bash
sudo apt update && sudo apt install -y git
git --version
```

### Configuration commune (Windows & Ubuntu)
```bash
git config --global user.name "Ton Nom"
git config --global user.email "ton@email.com"
```

---

## 2. Node.js 20 LTS (via nvm — recommandé)

### Windows
1. Télécharger nvm-windows : https://github.com/coreybutler/nvm-windows/releases
2. Installer nvm-setup.exe
3. Ouvrir un terminal en administrateur :
```powershell
nvm install 20
nvm use 20
node --version   # doit afficher v20.x.x
npm --version
```

### Ubuntu
```bash
# Installer nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Recharger le terminal
source ~/.bashrc

# Installer Node 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Vérifier
node --version   # v20.x.x
npm --version
```

---

## 3. Docker

### Windows
1. Télécharger Docker Desktop : https://www.docker.com/products/docker-desktop/
2. Activer WSL2 si demandé (recommandé)
3. Redémarrer
4. Vérifier dans un terminal :
```powershell
docker --version
docker compose version
```
### Erreur WSL
``` Si erreur de WSL a l'ouvertur de Docker
running wslexec: An error occurred while running the command. DockerDesktop/Wsl/ExecError: c:\windows\system32\wsl.exe --version: exit status 1 (stderr: Le Sous-système Windows pour Linux n’est pas installé. Vous pouvez effectuer l’installation en exécutant « wsl.exe --install ».

Pour plus d’informations, visitez https://aka.ms/wslinstall

, stdout: , wslErrorCode: DockerDesktop/Wsl/ExecError)
```
1. Ouvre PowerShell en administrateur et exécute :
```bash
wsl --version
```
2. Si tu obtiens le même message d'erreur, installe WSL :
```bash
wsl --install
```

### Ubuntu
```bash
# Installer Docker Engine
sudo apt update
sudo apt install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) \
  signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Ajouter ton user au groupe docker (évite sudo à chaque fois)
sudo usermod -aG docker $USER
newgrp docker

# Vérifier
docker --version
docker compose version
```

---

---

## 4. ProgesSQL
---
1. aller sur la page: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
2. télécharger la version 18 (la dernière à ce jour)
3. Faire l'installation par default de ProgresSQL
---

## 5. Cloner et initialiser Veridian

```bash
git clone https://github.com/frankydoody/Veridian.git
cd Veridian
```

### Démarrer la base de données PostgreSQL + pgvector
```bash
docker compose up -d

# Vérifier que le container tourne
docker compose ps

# Vérifier la connexion DB
docker exec veridian_db psql -U veridian_user -d veridian -c "SELECT version();"
```

### Installer les dépendances backend
```bash
cd backend
npm install

# Copier et remplir les variables d'environnement
cp .env.example .env
```

Ouvrir `.env` et remplir :
- `OPENAI_API_KEY` → ta clé OpenAI (https://platform.openai.com/api-keys)
- `ANTHROPIC_API_KEY` → ta clé Anthropic (https://console.anthropic.com/)
- `JWT_SECRET` → une chaîne aléatoire longue (ex: générer avec `openssl rand -hex 64`)

### Installer les dépendances frontend
```bash
cd ../frontend
npm install
cp .env.example .env
```

---

## 6. Démarrer le projet

Tu auras besoin de 2 terminaux ouverts simultanément.

**Terminal 1 — Backend**
```bash
cd Veridian/backend
npm run dev
# → API disponible sur http://localhost:3000
# → Health check : http://localhost:3000/api/health
```

**Terminal 2 — Frontend**
```bash
cd Veridian/frontend
npm run dev
# → App disponible sur http://localhost:5173
```

---

## 7. Éditeur recommandé — VS Code

### Installation
- Windows & Ubuntu : https://code.visualstudio.com/

### Extensions à installer
Ouvrir VS Code → Extensions (Ctrl+Shift+X) → rechercher et installer :

| Extension | Utilité |
|---|---|
| ESLint | Qualité du code JS |
| Prettier | Formatage automatique |
| GitLens | Visualisation Git avancée |
| REST Client | Tester les API sans Postman |
| PostgreSQL (cweijan) | Voir la DB dans VS Code |
| Docker | Gérer les containers |
| Thunder Client | Alternative légère à Postman |

### Ouvrir le projet
```bash
code Veridian/
```

---

## 8. Commandes utiles au quotidien

```bash
# Démarrer la DB
docker compose up -d

# Arrêter la DB
docker compose down

# Voir les logs de la DB
docker compose logs postgres

# Accéder à PostgreSQL directement
docker exec -it veridian_db psql -U veridian_user -d veridian

# Réinitialiser la DB (attention : efface tout)
docker compose down -v && docker compose up -d

# Générer une clé JWT sécurisée (Ubuntu/Git Bash)
openssl rand -hex 64
```

---

## 9. Vérification finale — checklist

- [ ] `git --version` → OK
- [ ] `node --version` → v20.x.x
- [ ] `npm --version` → OK
- [ ] `docker --version` → OK
- [ ] `docker compose ps` → veridian_db en état "healthy"
- [ ] http://localhost:3000/api/health → `{"status":"ok"}`
- [ ] http://localhost:5173 → page React s'affiche
- [ ] Fichier `backend/.env` rempli avec les clés API
- [ ] VS Code ouvert sur le dossier Veridian/

---

## 10. Logiciel UML pour les shématiques

- Windows et Ubuntu: https://github.com/ModelioOpenSource/Modelio/releases/tag/v5.4.1



*Veridian · Guide d'installation v1.0*
