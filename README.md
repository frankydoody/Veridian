# Veridian

Application web de mémoire organisationnelle pour réunions d'équipe.

---

## Ce dont tu as besoin avant de commencer

| Logiciel | Windows | Linux (Ubuntu) |
|---|---|---|
| Git | [Télécharger](https://git-scm.com/download/win) | `sudo apt install git` |
| Node.js 20 | [Télécharger nvm-windows](https://github.com/coreybutler/nvm-windows/releases) | Via nvm (voir ci-dessous) |
| Docker Desktop | [Télécharger](https://www.docker.com/products/docker-desktop/) | Via apt (voir ci-dessous) |
| Python 3 | [Télécharger](https://www.python.org/downloads/) | `sudo apt install python3-pip` |
| ffmpeg | [Télécharger](https://www.gyan.dev/ffmpeg/builds/) | `sudo apt install ffmpeg` |
| VS Code | [Télécharger](https://code.visualstudio.com/) | [Télécharger](https://code.visualstudio.com/) |

---

## Installation étape par étape

### 1. Git

**Windows**
1. Télécharge et installe depuis https://git-scm.com/download/win
2. Accepte toutes les options par défaut
3. Ouvre PowerShell et configure :
```powershell
git config --global user.name "Ton Nom"
git config --global user.email "ton@email.com"
```

**Ubuntu**
```bash
sudo apt update && sudo apt install -y git
git config --global user.name "Ton Nom"
git config --global user.email "ton@email.com"
```

---

### 2. Node.js 20

**Windows**
1. Télécharge `nvm-setup.exe` depuis https://github.com/coreybutler/nvm-windows/releases
2. Installe en administrateur
3. Ouvre PowerShell en administrateur et tape :
```powershell
nvm install 20
nvm use 20
node --version  # doit afficher v20.x.x
```

**Ubuntu**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
node --version  # doit afficher v20.x.x
```

---

### 3. Docker

**Windows**
1. Télécharge depuis https://www.docker.com/products/docker-desktop/
2. Installe et accepte l'activation de WSL 2 si demandé
3. Redémarre l'ordinateur
4. Lance Docker Desktop (icône dans la barre des tâches doit être verte)
5. Vérifie :
```powershell
docker --version
```

**Ubuntu**
```bash
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
sudo usermod -aG docker $USER
newgrp docker
docker --version  # vérification
```

---

### 4. Python + Whisper + ffmpeg

**Windows**
1. Télécharge Python depuis https://www.python.org/downloads/
   > ⚠️ Coche **"Add Python to PATH"** pendant l'installation
2. Télécharge ffmpeg depuis https://www.gyan.dev/ffmpeg/builds/ (prendre `ffmpeg-release-essentials.zip`)
3. Extrais le zip dans `C:\ffmpeg`
4. Ajoute `C:\ffmpeg\bin` au PATH Windows :
   - Cherche **"Variables d'environnement"** dans le menu Démarrer
   - Clique **Variables d'environnement**
   - Dans **Variables système**, sélectionne **Path** → **Modifier**
   - Ajoute `C:\ffmpeg\bin`
   - Clique OK partout et redémarre PowerShell
5. Installe Whisper :
```powershell
pip install openai-whisper
whisper --help  # vérification
```

**Ubuntu**
```bash
sudo apt install -y python3-pip ffmpeg
pip3 install openai-whisper --break-system-packages
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
whisper --help  # vérification
```

---

### 5. Clé API Gemini (gratuit)

1. Va sur https://aistudio.google.com/app/apikey
2. Connecte-toi avec un compte Google
3. Clique **Create API Key**
4. Copie la clé — tu en auras besoin plus tard

---

## Démarrer Veridian pour la première fois

### Étape 1 — Cloner le projet

**Windows (PowerShell)**
```powershell
cd C:\
mkdir Dev
cd Dev
git clone https://github.com/frankydoody/Veridian.git
cd Veridian
```

**Ubuntu**
```bash
mkdir -p ~/dev
cd ~/dev
git clone https://github.com/frankydoody/Veridian.git
cd Veridian
```

---

### Étape 2 — Démarrer la base de données

```bash
docker compose up -d
```

Attends 20 secondes puis vérifie :
```bash
docker compose ps
# Tu dois voir "veridian_db" avec le statut "healthy"
```

---

### Étape 3 — Créer les tables de la base de données

**Windows**
```powershell
docker exec -i veridian_db psql -U veridian_user -d veridian < Projet\Backend\database\schema.sql
```

**Ubuntu**
```bash
docker exec -i veridian_db psql -U veridian_user -d veridian < Projet/Backend/database/schema.sql
```

---

### Étape 4 — Installer les dépendances

**Windows**
```powershell
cd Projet\Backend
npm install
```

**Ubuntu**
```bash
cd Projet/Backend
npm install
```

---

### Étape 5 — Créer le fichier de configuration

Crée un fichier nommé `.env` dans le dossier `Projet/Backend/` et copie ce contenu :

```
PORT=3000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=veridian
DB_USER=veridian_user
DB_PASSWORD=veridian_pass

JWT_SECRET=change_cette_valeur_par_nimporte_quelle_longue_phrase
JWT_EXPIRES_IN=7d

AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash
GEMINI_API_KEY=colle_ta_cle_gemini_ici

WHISPER_MODE=local
WHISPER_MODEL=small
WHISPER_LANGUAGE=fr
```

> ⚠️ Remplace `colle_ta_cle_gemini_ici` par ta vraie clé Gemini

---

### Étape 6 — Lancer l'application

```bash
npm run dev
```

Tu dois voir :
```
✅ Connexion PostgreSQL établie
🚀 Serveur Veridian démarré sur http://localhost:3000
```

Ouvre ton navigateur et va à :
```
http://localhost:3000/api/health
```

Tu dois voir : `{"status":"ok"}`

**Félicitations — Veridian fonctionne !** 🎉

---

## En cas de problème

**Docker ne démarre pas (Windows)**
→ Ouvre Docker Desktop manuellement depuis le menu Démarrer et attends que l'icône soit verte

**Erreur de connexion PostgreSQL**
```bash
# Réinitialiser complètement la base de données
docker compose down -v
docker compose up -d
# Attendre 20 secondes puis refaire l'étape 3
```

**Port 3000 déjà utilisé**
→ Change `PORT=3000` par `PORT=3001` dans le fichier `.env`

---

*Veridian — INF4018 — Francis Côté*