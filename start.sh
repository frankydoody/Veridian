#!/usr/bin/env bash
# =============================================================================
# start.sh — Démarre l'environnement de développement Veridian (Linux)
#
# Usage :   ./start.sh
#
# Ce que fait le script, dans l'ordre :
#   1. Vérifie les prérequis (docker, node, npm, curl, fichier .env)
#   2. Démarre la base de données PostgreSQL (Docker) et attend qu'elle soit prête
#   3. Installe les dépendances npm si elles sont absentes
#   3b. Crée le schéma puis applique les migrations si la base est vide
#   3c. Ajoute les données de démonstration si la base n'a aucun utilisateur
#   4. Ouvre un terminal pour le backend et un terminal pour le frontend
#   5. Attend que les deux serveurs répondent, puis ouvre le navigateur
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/Projet/Backend"
FRONTEND="$ROOT/Projet/Frontend"
DB_CONTAINER="veridian_db"
API_URL="http://localhost:3000/api/health"
APP_URL="http://localhost:5173"

info() { echo -e "\033[1;34m[Veridian]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[Veridian]\033[0m $*"; }
warn() { echo -e "\033[1;33m[Veridian]\033[0m $*"; }
fail() { echo -e "\033[1;31m[Veridian]\033[0m $*" >&2; exit 1; }

# Retourne 0 dès que l'URL répond (essais espacés d'une seconde)
wait_for_url() {
  local url="$1" tries="$2"
  for _ in $(seq 1 "$tries"); do
    if curl -s -o /dev/null "$url"; then return 0; fi
    sleep 1
  done
  return 1
}

# Ouvre un nouveau terminal, s'y place dans un dossier et lance une commande.
# "bash -ic" charge ~/.bashrc (nécessaire pour nvm) ; "exec bash" garde le
# terminal ouvert si la commande s'arrête.
open_terminal() {
  local title="$1" dir="$2" cmd="$3"
  local inner="cd '$dir' && $cmd; exec bash"

  if command -v gnome-terminal >/dev/null 2>&1; then
    gnome-terminal --title="$title" -- bash -ic "$inner"
  elif command -v konsole >/dev/null 2>&1; then
    konsole -p tabtitle="$title" -e bash -ic "$inner" &
  elif command -v x-terminal-emulator >/dev/null 2>&1; then
    x-terminal-emulator -T "$title" -e bash -ic "$inner" &
  elif command -v xterm >/dev/null 2>&1; then
    xterm -T "$title" -e bash -ic "$inner" &
  else
    fail "Aucun terminal graphique trouvé (gnome-terminal, konsole, xterm)."
  fi
}

# ─── 1. Prérequis ────────────────────────────────────────────────────────────

info "Vérification des prérequis..."

for cmd in docker node npm curl; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Commande introuvable : $cmd"
done

if ! docker info >/dev/null 2>&1; then
  fail "Docker ne répond pas. Vérifie qu'il est démarré ; si tu vois « permission denied », lance : exec su -l \$USER"
fi

[ -f "$BACKEND/.env" ] || fail "Fichier manquant : $BACKEND/.env"

if ! command -v whisper >/dev/null 2>&1; then
  warn "Commande « whisper » introuvable : la transcription audio ne fonctionnera pas."
fi

# ─── 2. Base de données ──────────────────────────────────────────────────────

info "Démarrage de la base de données..."
(cd "$ROOT" && docker compose up -d)

info "Attente de la base de données..."
status="absent"
for _ in $(seq 1 30); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "absent")"
  if [ "$status" = "healthy" ]; then break; fi
  sleep 2
done

[ "$status" = "healthy" ] || fail "La base de données n'est pas prête (état : $status). Voir : docker compose logs postgres"
ok "Base de données prête."

# ─── 3. Dépendances npm ──────────────────────────────────────────────────────

if [ ! -d "$BACKEND/node_modules" ]; then
  info "Installation des dépendances du backend..."
  (cd "$BACKEND" && npm install)
fi

if [ ! -d "$FRONTEND/node_modules" ]; then
  info "Installation des dépendances du frontend..."
  (cd "$FRONTEND" && npm install)
fi

# ─── 3b. Initialisation de la base (premier clone seulement) ─────────────────

# Applique un fichier SQL dans le conteneur ; la première erreur arrête le script.
apply_sql() {
  docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -q -U veridian_user -d veridian < "$1" \
    || fail "Échec de l'application de $(basename "$1") (voir l'erreur SQL ci-dessus)."
}

table_exists="$(docker exec "$DB_CONTAINER" psql -U veridian_user -d veridian -tAc \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users');" 2>/dev/null || echo "")"

if [ "$table_exists" != "t" ]; then
  info "Base de données vide détectée. Création du schéma..."

  # Ordre obligatoire : le schéma de base, puis les migrations
  # (les migrations modifient ou référencent les tables du schéma).
  [ -f "$BACKEND/database/schema.sql" ] || fail "Fichier manquant : $BACKEND/database/schema.sql"
  info "  Schéma : schema.sql"
  apply_sql "$BACKEND/database/schema.sql"

  for f in "$BACKEND"/database/migrations/*.sql; do
    [ -e "$f" ] || continue
    info "  Migration : $(basename "$f")"
    apply_sql "$f"
  done
  ok "Schéma et migrations appliqués."
else
  ok "Base de données déjà initialisée."
fi

# ─── 3c. Données de démonstration (base sans aucun utilisateur seulement) ────
# NO_SEED=1 ./start.sh   pour ne pas les ajouter.

user_count="$(docker exec "$DB_CONTAINER" psql -U veridian_user -d veridian -tAc \
  "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "")"

if [ "$user_count" = "0" ] && [ "${NO_SEED:-0}" != "1" ]; then
  info "Ajout des données de démonstration (3 comptes, 3 projets, réunions, décisions, tâches)..."
  if (cd "$BACKEND" && node database/seed.js); then
    ok "Données de démonstration ajoutées : admin@example.com / mot de passe 12345678"
  else
    warn "Les données de démonstration n'ont pas pu être ajoutées (l'application fonctionne quand même)."
  fi
fi

# ─── 4. Terminaux backend et frontend ────────────────────────────────────────

if curl -s -o /dev/null "$API_URL"; then
  warn "Le backend tourne déjà : aucun nouveau terminal ouvert."
else
  info "Ouverture du terminal Backend..."
  open_terminal "Veridian - Backend" "$BACKEND" "npm run dev"
fi

if curl -s -o /dev/null "$APP_URL"; then
  warn "Le frontend tourne déjà : aucun nouveau terminal ouvert."
else
  info "Ouverture du terminal Frontend..."
  open_terminal "Veridian - Frontend" "$FRONTEND" "npm run dev"
fi

# ─── 5. Vérification finale ──────────────────────────────────────────────────

info "Attente des serveurs..."

if wait_for_url "$API_URL" 30; then
  ok "Backend prêt  : http://localhost:3000"
else
  warn "Le backend ne répond pas : regarde le terminal « Veridian - Backend »."
fi

if wait_for_url "$APP_URL" 30; then
  ok "Frontend prêt : $APP_URL"
  xdg-open "$APP_URL" >/dev/null 2>&1 || true
else
  warn "Le frontend ne répond pas sur le port 5173 : regarde l'adresse affichée dans le terminal « Veridian - Frontend »."
fi

echo
info "Pour tout arrêter : Ctrl+C dans chaque terminal, puis « docker compose down » à la racine."
