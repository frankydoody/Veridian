#!/usr/bin/env bash
# =============================================================================
# start.sh — Installe, vérifie et démarre Veridian sur Linux
#
# Usage :   ./start.sh [--skip-whisper] [--install-only] [--no-seed] [--stop]
#
# Fonctionne sur un PC vierge (seulement le clone du dépôt) comme sur un PC où
# l'application est déjà installée : chaque étape vérifie d'abord ce qui existe
# et n'installe que ce qui manque. Distributions gérées : Debian/Ubuntu/Mint
# (apt), Fedora/RHEL (dnf), Arch/Manjaro (pacman).
#
# Étapes, dans l'ordre :
#   1. Détection de la distribution, mise à jour de la liste des paquets
#   2. Fichier .env : créé ou complété (secret JWT généré, valeurs imposées)
#   3. Node.js 20+, Docker (+ compose), Python/ffmpeg/Whisper : installés si absents
#   4. Dépendances npm (backend et frontend) : installées ou mises à jour
#   5. Base PostgreSQL (Docker) : démarrage, schéma, migrations non appliquées
#   6. Données de démonstration (seulement si la base n'a aucun utilisateur)
#   7. Backend et frontend dans deux terminaux (ou en arrière-plan sans écran)
#
# Options :
#   --skip-whisper  ne pas installer Python/ffmpeg/Whisper (pas de transcription)
#   --install-only  tout installer et préparer, sans lancer les serveurs
#   --no-seed       ne pas ajouter les données de démonstration (NO_SEED=1 aussi)
#   --stop          arrêter les serveurs lancés en arrière-plan et la base
# =============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/Projet/Backend"
FRONTEND="$ROOT/Projet/Frontend"
ENV_FILE="$BACKEND/.env"
LOG_DIR="$ROOT/.veridian-logs"
DB_CONTAINER="veridian_db"
DB_USER="veridian_user"
DB_NAME="veridian"
API_URL="http://localhost:3000/api/health"
APP_URL="http://localhost:5173"
NODE_MIN_MAJOR=20
WHISPER_VENV="$HOME/.veridian/whisper-venv"

SKIP_WHISPER="${SKIP_WHISPER:-0}"
INSTALL_ONLY=0
NO_SEED="${NO_SEED:-0}"
STOP_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --skip-whisper) SKIP_WHISPER=1 ;;
    --install-only) INSTALL_ONLY=1 ;;
    --no-seed)      NO_SEED=1 ;;
    --stop)         STOP_ONLY=1 ;;
    -h|--help)      awk 'NR>1 && /^# =+$/ {c++; if (c==2) exit} NR>1 {sub(/^# ?/, ""); print}' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Option inconnue : $arg (voir --help)" >&2; exit 2 ;;
  esac
done

# ─── Affichage ───────────────────────────────────────────────────────────────

info() { echo -e "\033[1;34m[Veridian]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[Veridian]\033[0m $*"; }
warn() { echo -e "\033[1;33m[Veridian]\033[0m $*"; }
fail() { echo -e "\033[1;31m[Veridian] ERREUR :\033[0m $*" >&2; exit 1; }

has() { command -v "$1" >/dev/null 2>&1; }

# ─── Droits administrateur et gestionnaire de paquets ────────────────────────

# Exécute une commande en root (directement, ou via sudo)
run_root() {
  if [ "$(id -u)" -eq 0 ]; then "$@"
  elif has sudo; then sudo "$@"
  else fail "Cette étape demande les droits administrateur (sudo introuvable). Relance le script en root."
  fi
}

PM=""
detect_package_manager() {
  if   has apt-get; then PM="apt"
  elif has dnf;     then PM="dnf"
  elif has pacman;  then PM="pacman"
  else PM=""
  fi
}

APT_UPDATED=0
# Met à jour la liste des paquets (une seule fois par exécution)
update_package_list() {
  [ "$APT_UPDATED" -eq 1 ] && return 0
  case "$PM" in
    apt)    info "Mise à jour de la liste des paquets (apt update)..."; run_root apt-get update -y >/dev/null 2>&1 || warn "apt update a échoué : l'installation peut utiliser une liste périmée." ;;
    dnf)    info "Mise à jour de la liste des paquets (dnf)..."; run_root dnf makecache -y >/dev/null 2>&1 || true ;;
    pacman) info "Mise à jour de la liste des paquets (pacman -Sy)..."; run_root pacman -Sy --noconfirm >/dev/null 2>&1 || true ;;
  esac
  APT_UPDATED=1
}

# Installe des paquets avec le gestionnaire de la distribution
pkg_install() {
  [ -n "$PM" ] || return 1
  update_package_list
  case "$PM" in
    apt)    DEBIAN_FRONTEND=noninteractive run_root apt-get install -y "$@" ;;
    dnf)    run_root dnf install -y "$@" ;;
    pacman) run_root pacman -S --noconfirm --needed "$@" ;;
  esac
}

# ─── Outils réseau ───────────────────────────────────────────────────────────

wait_for_url() {
  local url="$1" tries="$2"
  for _ in $(seq 1 "$tries"); do
    if curl -s -o /dev/null "$url"; then return 0; fi
    sleep 1
  done
  return 1
}

# 0 si un programme écoute déjà sur ce port local
port_busy() { (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }

# ─── Arrêt (--stop) ──────────────────────────────────────────────────────────

stop_everything() {
  info "Arrêt de Veridian..."
  for name in backend frontend; do
    pidfile="$LOG_DIR/$name.pid"
    if [ -f "$pidfile" ]; then
      pid="$(cat "$pidfile")"
      if kill -0 "$pid" 2>/dev/null; then
        kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
        ok "Serveur $name arrêté."
      fi
      rm -f "$pidfile"
    fi
  done
  detect_package_manager
  select_docker_commands quiet
  if [ "${#COMPOSE_CMD[@]}" -gt 0 ]; then
    (cd "$ROOT" && "${COMPOSE_CMD[@]}" down) && ok "Base de données arrêtée."
  fi
  info "Les terminaux ouverts par le script (s'il y en a) se ferment avec Ctrl+C."
  exit 0
}

# ─── Fichier .env ────────────────────────────────────────────────────────────

env_get() { # clé -> valeur (vide si absente)
  grep -E "^$1=" "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d= -f2-
}

env_has_key() { grep -qE "^$1=" "$ENV_FILE" 2>/dev/null; }

env_set() { # remplace ou ajoute clé=valeur ; retourne 0 si le fichier a changé
  local key="$1" value="$2"
  if env_has_key "$key"; then
    [ "$(env_get "$key")" = "$value" ] && return 1
    local tmp; tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' "$ENV_FILE" > "$tmp" && cat "$tmp" > "$ENV_FILE"
    rm -f "$tmp"
  else
    [ -s "$ENV_FILE" ] && [ -n "$(tail -c1 "$ENV_FILE")" ] && echo >> "$ENV_FILE"
    echo "$key=$value" >> "$ENV_FILE"
  fi
  return 0
}

env_set_if_missing() { # ajoute seulement si absent ou vide
  local key="$1" value="$2"
  if env_has_key "$key" && [ -n "$(env_get "$key")" ]; then return 1; fi
  env_set "$key" "$value"
}

new_secret() {
  openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
}

initialize_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    info "Fichier Projet/Backend/.env absent : création avec les valeurs par défaut..."
    : > "$ENV_FILE"
  fi
  # Fichier venu de Windows : fins de ligne CRLF et BOM retirés (sinon les valeurs sont corrompues)
  sed -i 's/\r$//; 1s/^\xEF\xBB\xBF//' "$ENV_FILE"

  local added=() fixed=() pair key value
  for pair in PORT=3000 DB_HOST=localhost DB_PORT=5432 DB_NAME=veridian DB_USER=veridian_user \
              DB_PASSWORD=veridian_pass JWT_EXPIRES_IN=7d AI_PROVIDER=gemini AI_MODEL=gemini-2.5-flash \
              WHISPER_MODE=local WHISPER_MODEL=small WHISPER_LANGUAGE=fr; do
    key="${pair%%=*}"; value="${pair#*=}"
    env_set_if_missing "$key" "$value" && added+=("$key")
  done
  env_set_if_missing JWT_SECRET "$(new_secret)" && added+=("JWT_SECRET (généré)")

  # Valeurs imposées : elles doivent correspondre à docker-compose.yml et au frontend
  for pair in PORT=3000 DB_HOST=localhost DB_PORT=5432 DB_NAME=veridian DB_USER=veridian_user DB_PASSWORD=veridian_pass; do
    key="${pair%%=*}"; value="${pair#*=}"
    env_set "$key" "$value" && fixed+=("$key")
  done
  [ "${#fixed[@]}" -gt 0 ] && warn "Valeurs corrigées dans .env pour correspondre à Docker/frontend : ${fixed[*]}"

  # Anciens modèles Gemini retirés par Google
  local model; model="$(env_get AI_MODEL)"
  if [[ "$model" =~ ^gemini-1\. ]]; then
    env_set AI_MODEL gemini-2.5-flash >/dev/null
    warn "Modèle $model retiré par Google : remplacé par gemini-2.5-flash."
  fi

  # Clé Gemini : indispensable pour l'IA. Demandée une seule fois, en mode interactif.
  if [ -z "$(env_get GEMINI_API_KEY)" ]; then
    warn "Le .env ne contient pas de clé GEMINI_API_KEY (le fichier .env fourni avec le projet devrait la contenir)."
    local key_in=""
    if [ -t 0 ] && [ -t 1 ]; then
      echo
      echo "  Une clé API Gemini est nécessaire pour les fonctions d'IA."
      echo "  Gratuite : https://aistudio.google.com/apikey  (laisse vide pour l'ajouter plus tard)"
      read -r -p "  Clé API Gemini : " key_in || key_in=""
      key_in="$(echo "$key_in" | tr -d '[:space:]')"
    fi
    if [ -n "$key_in" ]; then
      env_set GEMINI_API_KEY "$key_in" >/dev/null; added+=("GEMINI_API_KEY")
    else
      env_has_key GEMINI_API_KEY || echo "GEMINI_API_KEY=" >> "$ENV_FILE"
      warn "Aucune clé Gemini : l'application démarre, mais l'IA ne fonctionnera pas."
      warn "Ajoute-la plus tard dans $ENV_FILE (ligne GEMINI_API_KEY=...) puis redémarre le backend."
    fi
  fi

  chmod 600 "$ENV_FILE" 2>/dev/null || true
  if [ "${#added[@]}" -gt 0 ]; then ok "Fichier .env complété : ${added[*]}"
  else ok "Fichier .env présent et complet."; fi
}

# ─── Prérequis de base ───────────────────────────────────────────────────────

confirm_base_tools() {
  local missing=()
  for tool in curl; do has "$tool" || missing+=("$tool"); done
  has openssl || missing+=("openssl")
  if [ "${#missing[@]}" -gt 0 ]; then
    info "Installation des outils de base : ${missing[*]}..."
    pkg_install "${missing[@]}" ca-certificates || fail "Impossible d'installer : ${missing[*]}. Installe-les à la main puis relance le script."
  fi
}

# ─── Node.js ─────────────────────────────────────────────────────────────────

node_major() { node --version 2>/dev/null | sed 's/^v\([0-9]*\).*/\1/'; }
node_ok() { has node && has npm && [ "$(node_major)" -ge "$NODE_MIN_MAJOR" ] 2>/dev/null; }

confirm_node() {
  if node_ok; then ok "Node.js $(node --version) déjà installé."; return; fi
  has node && warn "Node.js $(node --version) est trop ancien (version $NODE_MIN_MAJOR ou plus requise)."

  info "Installation de Node.js 22 (LTS)..."
  case "$PM" in
    apt) curl -fsSL https://deb.nodesource.com/setup_22.x | run_root bash - >/dev/null 2>&1 && pkg_install nodejs ;;
    dnf) curl -fsSL https://rpm.nodesource.com/setup_22.x | run_root bash - >/dev/null 2>&1 && pkg_install nodejs ;;
    pacman) pkg_install nodejs npm ;;
  esac
  hash -r

  # Plan B sans droits administrateur : nvm (installation dans le dossier personnel)
  if ! node_ok; then
    warn "Installation système impossible : essai avec nvm (dossier personnel)..."
    export NVM_DIR="$HOME/.nvm"
    if [ ! -s "$NVM_DIR/nvm.sh" ]; then
      curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null 2>&1
    fi
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm install 22 >/dev/null 2>&1
    hash -r
  fi
  node_ok || fail "Node.js $NODE_MIN_MAJOR ou plus est introuvable après l'installation. Installe-le depuis https://nodejs.org puis relance le script."
  ok "Node.js $(node --version) installé."
}

# ─── Docker ──────────────────────────────────────────────────────────────────

DOCKER_CMD=(docker)
COMPOSE_CMD=()

install_docker() {
  info "Installation de Docker..."
  case "$PM" in
    apt|dnf)
      if ! { curl -fsSL https://get.docker.com | run_root sh; }; then
        warn "Le script officiel Docker a échoué : essai avec les paquets de la distribution..."
        if [ "$PM" = "apt" ]; then
          pkg_install docker.io docker-compose-v2 || pkg_install docker.io docker-compose-plugin || pkg_install docker.io docker-compose
        else
          pkg_install moby-engine docker-compose
        fi
      fi ;;
    pacman) pkg_install docker docker-compose ;;
    *) fail "Distribution non reconnue : installe Docker à la main (https://docs.docker.com/engine/install/) puis relance le script." ;;
  esac
  hash -r
  has docker || fail "Docker est introuvable après l'installation. Installe-le à la main (https://docs.docker.com/engine/install/) puis relance le script."
}

# Choisit la façon d'appeler docker (direct ou via sudo) et docker compose
select_docker_commands() {
  local mode="${1:-normal}"
  has docker || { COMPOSE_CMD=(); return 1; }
  if docker info >/dev/null 2>&1; then DOCKER_CMD=(docker)
  elif has sudo && sudo docker info >/dev/null 2>&1; then DOCKER_CMD=(sudo docker)
  else COMPOSE_CMD=(); return 1; fi

  if "${DOCKER_CMD[@]}" compose version >/dev/null 2>&1; then COMPOSE_CMD=("${DOCKER_CMD[@]}" compose)
  elif has docker-compose; then
    if [ "${DOCKER_CMD[0]}" = "sudo" ]; then COMPOSE_CMD=(sudo docker-compose); else COMPOSE_CMD=(docker-compose); fi
  else COMPOSE_CMD=(); fi
  [ "$mode" = "quiet" ] || true
  return 0
}

dk() { "${DOCKER_CMD[@]}" "$@"; }

confirm_docker() {
  if ! has docker; then install_docker; else ok "Docker déjà installé."; fi

  # Le service doit tourner (démarré et activé au démarrage du PC)
  if ! docker info >/dev/null 2>&1 && has systemctl; then
    info "Démarrage du service Docker..."
    run_root systemctl enable --now docker >/dev/null 2>&1 || run_root systemctl start docker >/dev/null 2>&1 || true
  fi

  # Fait partie du groupe docker ? sinon on l'y ajoute (effet à la prochaine connexion)
  if [ "$(id -u)" -ne 0 ] && ! id -nG | tr ' ' '\n' | grep -qx docker; then
    if getent group docker >/dev/null 2>&1; then
      run_root usermod -aG docker "$USER" 2>/dev/null && \
        warn "Tu as été ajouté au groupe « docker » : pour taper docker sans sudo, ferme ta session puis reconnecte-toi. Pour l'instant le script utilise sudo."
    fi
  fi

  local tries=0
  until select_docker_commands; do
    tries=$((tries + 1))
    [ "$tries" -ge 20 ] && fail "Docker ne répond pas. Essaie : sudo systemctl start docker  (puis relance le script)."
    sleep 1
  done
  [ "${#COMPOSE_CMD[@]}" -gt 0 ] || { pkg_install docker-compose-v2 >/dev/null 2>&1 || pkg_install docker-compose-plugin >/dev/null 2>&1 || pkg_install docker-compose >/dev/null 2>&1; select_docker_commands; }
  [ "${#COMPOSE_CMD[@]}" -gt 0 ] || fail "« docker compose » est introuvable. Installe le paquet docker-compose-plugin (ou docker-compose) puis relance le script."
  ok "Docker prêt ($(dk --version | cut -d, -f1))."
}

# ─── Python, ffmpeg et Whisper ───────────────────────────────────────────────

PY=""
find_python() {
  PY=""
  local c v minor
  for c in python3.12 python3.11 python3.10 python3.13 python3.9 python3; do
    has "$c" || continue
    v="$("$c" -c 'import sys; print(sys.version_info[0]*100+sys.version_info[1])' 2>/dev/null)" || continue
    minor=$((v))
    if [ "$minor" -ge 309 ] && [ "$minor" -le 313 ]; then PY="$c"; return 0; fi
  done
  return 1
}

confirm_whisper() {
  if [ "$SKIP_WHISPER" = "1" ]; then
    warn "--skip-whisper : Python, ffmpeg et Whisper ne sont pas installés (pas de transcription audio)."
    return
  fi

  # Python 3.9 à 3.13 (versions prises en charge par Whisper)
  if ! find_python; then
    info "Installation de Python 3..."
    case "$PM" in
      apt)    pkg_install python3 python3-venv python3-pip ;;
      dnf)    pkg_install python3 python3-pip ;;
      pacman) pkg_install python python-pip ;;
    esac
    find_python || {
      warn "Aucun Python 3.9 à 3.13 disponible : la transcription audio ne fonctionnera pas."
      warn "Installe Python 3.12 puis relance le script (ou utilise --skip-whisper pour ignorer cette étape)."
      return
    }
  fi
  ok "Python disponible ($PY)."

  # ffmpeg (requis par Whisper pour lire l'audio)
  if has ffmpeg; then ok "ffmpeg déjà installé."
  else
    info "Installation de ffmpeg..."
    pkg_install ffmpeg || { [ "$PM" = "dnf" ] && pkg_install ffmpeg-free; }
    has ffmpeg || warn "ffmpeg n'a pas pu être installé : la transcription audio échouera tant qu'il manque."
  fi

  # Whisper dans un environnement virtuel (évite les blocages « externally-managed-environment »)
  if [ ! -x "$WHISPER_VENV/bin/whisper" ]; then
    info "Installation de Whisper (plusieurs Go à télécharger, patience)..."
    mkdir -p "$(dirname "$WHISPER_VENV")"
    if ! "$PY" -m venv "$WHISPER_VENV" >/dev/null 2>&1; then
      [ "$PM" = "apt" ] && pkg_install python3-venv python3-pip >/dev/null 2>&1
      rm -rf "$WHISPER_VENV"
      "$PY" -m venv "$WHISPER_VENV" >/dev/null 2>&1 || { warn "Impossible de créer l'environnement Python : Whisper non installé."; return; }
    fi
    "$WHISPER_VENV/bin/python" -m pip install --quiet --upgrade pip >/dev/null 2>&1
    # Version CPU de PyTorch d'abord : évite ~3 Go de bibliothèques GPU inutiles
    "$WHISPER_VENV/bin/python" -m pip install --quiet torch --index-url https://download.pytorch.org/whl/cpu >/dev/null 2>&1 \
      || warn "PyTorch CPU indisponible : installation de la version standard (plus volumineuse)."
    if ! "$WHISPER_VENV/bin/python" -m pip install --quiet openai-whisper; then
      warn "L'installation de Whisper a échoué : la transcription audio ne fonctionnera pas."
      warn "Relance le script plus tard, ou utilise --skip-whisper pour ignorer cette étape."
      return
    fi
  else
    ok "Whisper déjà installé."
  fi

  # La commande « whisper » doit être trouvée par le backend
  mkdir -p "$HOME/.local/bin"
  ln -sf "$WHISPER_VENV/bin/whisper" "$HOME/.local/bin/whisper"
  case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac
  has whisper && ok "Whisper prêt." || warn "La commande « whisper » n'est pas visible dans le PATH."

  # Modèle téléchargé une fois pour toutes (sinon la 1re transcription semble figée)
  local model; model="$(env_get WHISPER_MODEL)"; model="${model:-small}"
  if [ -f "$HOME/.cache/whisper/$model.pt" ]; then ok "Modèle Whisper « $model » déjà téléchargé."
  else
    info "Téléchargement du modèle Whisper « $model » (une seule fois)..."
    if "$WHISPER_VENV/bin/python" -c "import whisper; whisper.load_model('$model')" >/dev/null 2>&1; then ok "Modèle Whisper « $model » prêt."
    else warn "Le modèle Whisper sera téléchargé lors de la première transcription."; fi
  fi
}

# ─── Dépendances npm ─────────────────────────────────────────────────────────

# Installe si node_modules est absent, incomplet, ou plus ancien que package-lock.json
# (cas d'un git pull qui ajoute une dépendance).
confirm_npm_dependencies() {
  local dir="$1" label="$2" stamp="$1/node_modules/.package-lock.json" needed=0
  if [ ! -d "$dir/node_modules" ] || [ ! -f "$stamp" ]; then needed=1
  elif [ -f "$dir/package-lock.json" ] && [ "$dir/package-lock.json" -nt "$stamp" ]; then needed=1
  fi
  if [ "$needed" -eq 0 ]; then ok "Dépendances $label à jour."; return; fi
  info "Installation des dépendances $label..."
  (cd "$dir" && npm install --no-audit --no-fund) || fail "npm install a échoué dans $label."
  ok "Dépendances $label installées."
}

# ─── Base de données ─────────────────────────────────────────────────────────

sql() { dk exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1" 2>/dev/null; }

# Applique un fichier SQL ; la première erreur arrête tout
apply_sql() {
  dk exec -i -e PGOPTIONS=--client-min-messages=warning "$DB_CONTAINER" \
    psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" < "$1" \
    || fail "Échec de l'application de $(basename "$1") (voir l'erreur SQL ci-dessus)."
}

start_database() {
  local state
  state="$(dk inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || echo false)"
  if [ "$state" != "true" ] && port_busy 5432; then
    fail "Le port 5432 est déjà utilisé par un autre programme (souvent un PostgreSQL installé sur ce PC). Arrête-le : sudo systemctl stop postgresql  — puis relance le script."
  fi

  info "Démarrage de la base de données..."
  (cd "$ROOT" && "${COMPOSE_CMD[@]}" up -d) || fail "docker compose up a échoué. Voir : docker compose logs postgres"

  info "Attente de la base de données..."
  local status="absent"
  for _ in $(seq 1 45); do
    status="$(dk inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo absent)"
    [ "$status" = "healthy" ] && break
    sleep 2
  done
  [ "$status" = "healthy" ] || fail "La base de données n'est pas prête (état : $status). Voir : docker compose logs postgres"
  ok "Base de données prête."
}

# Crée le schéma si la base est vide, puis applique les migrations pas encore
# appliquées (mémorisées dans la table schema_migrations, comme sous Windows) :
# relancer le script ne rejoue jamais une migration, et une nouvelle migration
# ajoutée par un git pull est appliquée automatiquement.
initialize_database() {
  local has_users; has_users="$(sql "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users');")"

  if [ "$has_users" != "t" ]; then
    info "Base de données vide détectée. Création du schéma..."
    [ -f "$BACKEND/database/schema.sql" ] || fail "Fichier manquant : $BACKEND/database/schema.sql"
    info "  Schéma : schema.sql"
    apply_sql "$BACKEND/database/schema.sql"
  else
    ok "Schéma de base déjà présent."
  fi

  sql "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());" >/dev/null

  local applied=0 f name
  for f in "$BACKEND"/database/migrations/*.sql; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    [ "$(sql "SELECT 1 FROM schema_migrations WHERE name = '$name';")" = "1" ] && continue
    info "  Migration : $name"
    apply_sql "$f"
    sql "INSERT INTO schema_migrations (name) VALUES ('$name') ON CONFLICT DO NOTHING;" >/dev/null
    applied=$((applied + 1))
  done
  if [ "$applied" -gt 0 ]; then ok "$applied migration(s) appliquée(s)."
  else ok "Base de données à jour (aucune migration à appliquer)."; fi
}

# Données de démonstration : seulement si la base ne contient AUCUN utilisateur
initialize_seed() {
  if [ "$NO_SEED" = "1" ]; then warn "Données de démonstration non ajoutées (--no-seed)."; return; fi
  local count; count="$(sql "SELECT COUNT(*) FROM users;")"
  if [ "$count" != "0" ]; then ok "La base contient déjà des utilisateurs : données de démonstration non ajoutées."; return; fi

  info "Ajout des données de démonstration (3 comptes, 3 projets, réunions, décisions, tâches)..."
  [ -f "$BACKEND/database/seed.js" ] || { warn "seed.js introuvable."; return; }
  if (cd "$BACKEND" && node database/seed.js); then
    ok "Données de démonstration ajoutées : admin@example.com / mot de passe 12345678"
  else
    warn "Les données de démonstration n'ont pas pu être ajoutées (l'application fonctionne quand même)."
  fi
}

# ─── Lancement des serveurs ──────────────────────────────────────────────────

# Terminal graphique disponible ? (écran présent ET un émulateur installé)
graphical_terminal() {
  [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] || return 1
  for t in gnome-terminal konsole xfce4-terminal x-terminal-emulator xterm; do has "$t" && return 0; done
  return 1
}

# Lance un serveur : dans un nouveau terminal si possible, sinon en arrière-plan
# (journal dans .veridian-logs/). Le PATH courant est transmis (nvm, ~/.local/bin).
launch_server() {
  local name="$1" title="$2" dir="$3" cmd="$4"
  local inner; inner="export PATH=$(printf '%q' "$PATH"); cd $(printf '%q' "$dir") && $cmd; exec bash"

  if graphical_terminal; then
    if   has gnome-terminal;      then gnome-terminal --title="$title" -- bash -ic "$inner"
    elif has konsole;             then konsole -p tabtitle="$title" -e bash -ic "$inner" &
    elif has xfce4-terminal;      then xfce4-terminal --title="$title" -x bash -ic "$inner" &
    elif has x-terminal-emulator; then x-terminal-emulator -T "$title" -e bash -ic "$inner" &
    else xterm -T "$title" -e bash -ic "$inner" &
    fi
    ok "Terminal « $title » ouvert."
  else
    mkdir -p "$LOG_DIR"
    # setsid : le serveur survit à la fermeture du terminal ; son PID (= identifiant du groupe)
    # est mémorisé pour --stop
    (
      cd "$dir" || exit 1
      setsid nohup bash -c "$cmd" > "$LOG_DIR/$name.log" 2>&1 < /dev/null &
      echo $! > "$LOG_DIR/$name.pid"
    )
    ok "« $title » lancé en arrière-plan (journal : $LOG_DIR/$name.log ; arrêt : ./start.sh --stop)."
  fi
}

start_servers() {
  if ! curl -s -o /dev/null "$API_URL" && port_busy 3000; then
    fail "Le port 3000 est utilisé par un autre programme. Ferme-le puis relance le script."
  fi
  if ! curl -s -o /dev/null "$APP_URL" && port_busy 5173; then
    fail "Le port 5173 est utilisé par un autre programme. Ferme-le puis relance le script."
  fi

  if curl -s -o /dev/null "$API_URL"; then warn "Backend déjà démarré : aucun nouveau terminal ouvert."
  else info "Démarrage du backend..."; launch_server backend "Veridian - Backend" "$BACKEND" "npm run dev"; fi

  if curl -s -o /dev/null "$APP_URL"; then warn "Frontend déjà démarré : aucun nouveau terminal ouvert."
  else info "Démarrage du frontend..."; launch_server frontend "Veridian - Frontend" "$FRONTEND" "npm run dev"; fi

  info "Attente des serveurs..."
  if wait_for_url "$API_URL" 40; then ok "Backend prêt  : http://localhost:3000"
  else warn "Le backend ne répond pas encore : regarde le terminal « Veridian - Backend » (ou $LOG_DIR/backend.log)."; fi

  if wait_for_url "$APP_URL" 40; then
    ok "Frontend prêt : $APP_URL"
    [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && has xdg-open && { xdg-open "$APP_URL" >/dev/null 2>&1 || true; }
  else
    warn "Le frontend ne répond pas sur le port 5173 : regarde le terminal « Veridian - Frontend » (ou $LOG_DIR/frontend.log)."
  fi
}

# ─── Programme principal ─────────────────────────────────────────────────────

main() {
  [ "$STOP_ONLY" -eq 1 ] && stop_everything

  echo
  info "Veridian - installation et démarrage (Linux)"
  echo

  [ "$(uname -s)" = "Linux" ] || fail "Ce script est pour Linux. Sous Windows, utilise Demarrer.bat."
  [ -d "$BACKEND" ] && [ -d "$FRONTEND" ] || fail "Dossiers Projet/Backend et Projet/Frontend introuvables : lance le script depuis le dossier cloné."

  # Whisper installé par une exécution précédente : sa commande vit dans ~/.local/bin
  case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) export PATH="$HOME/.local/bin:$PATH" ;; esac

  detect_package_manager
  [ -n "$PM" ] || warn "Gestionnaire de paquets non reconnu (apt, dnf, pacman) : les installations automatiques sont désactivées."

  confirm_base_tools
  initialize_env_file
  confirm_node
  confirm_docker
  confirm_whisper

  confirm_npm_dependencies "$BACKEND"  "backend"
  confirm_npm_dependencies "$FRONTEND" "frontend"

  start_database
  initialize_database
  initialize_seed

  if [ "$INSTALL_ONLY" -eq 1 ]; then
    echo
    ok "Installation terminée (--install-only : les serveurs ne sont pas lancés)."
    ok "Pour démarrer : ./start.sh"
    return
  fi

  start_servers

  echo
  ok "============================================================"
  ok "  Veridian est prêt !"
  ok "  Frontend : http://localhost:5173"
  ok "  Backend  : http://localhost:3000"
  ok "  BD       : localhost:5432 (via Docker)"
  ok "  Compte   : admin@example.com / 12345678 (données de démonstration)"
  ok "============================================================"
  echo
  info "Pour tout arrêter : ./start.sh --stop   (ou Ctrl+C dans chaque terminal, puis docker compose down)"
}

# Permet de charger les fonctions sans lancer l'installation (tests) :
#   VERIDIAN_NO_MAIN=1 source ./start.sh
if [ -z "${VERIDIAN_NO_MAIN:-}" ]; then main "$@"; fi
