# =============================================================================
# start.ps1 - Demarre l'environnement de developpement Veridian (Windows)
#
# Usage :   powershell -ExecutionPolicy Bypass -File .\start.ps1
#
# Ce que fait le script, dans l'ordre :
#   1. Verifie les prerequis (docker, node, npm, fichier .env)
#   2. Demarre la base de donnees PostgreSQL (Docker) et attend qu'elle soit prete
#   3. Installe les dependances npm si elles sont absentes
#   4. Ouvre un terminal pour le backend et un terminal pour le frontend
#   5. Attend que les deux serveurs repondent, puis ouvre le navigateur
#
# Note : les messages sont ecrits sans accents, parce que Windows PowerShell 5
# lit mal les accents d'un fichier .ps1 enregistre en UTF-8 sans BOM.
# =============================================================================

$Root        = $PSScriptRoot
$Backend     = Join-Path $Root 'Projet\Backend'
$Frontend    = Join-Path $Root 'Projet\Frontend'
$DbContainer = 'veridian_db'
$ApiUrl      = 'http://localhost:3000/api/health'
$AppUrl      = 'http://localhost:5173'

function Info($Message) { Write-Host "[Veridian] $Message" -ForegroundColor Cyan }
function Ok($Message)   { Write-Host "[Veridian] $Message" -ForegroundColor Green }
function Warn($Message) { Write-Host "[Veridian] $Message" -ForegroundColor Yellow }
function Fail($Message) { Write-Host "[Veridian] $Message" -ForegroundColor Red; exit 1 }

# Retourne $true si l'URL repond
function Test-Url($Url) {
  try {
    Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

# Retourne $true des que l'URL repond (essais espaces d'une seconde)
function Wait-ForUrl($Url, $Tries) {
  for ($i = 0; $i -lt $Tries; $i++) {
    if (Test-Url $Url) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

# Ouvre une nouvelle fenetre PowerShell, s'y place dans un dossier et lance une commande.
# La commande est encodee en Base64 pour eviter les problemes de guillemets et d'espaces.
function Open-Terminal($Title, $Dir, $Command) {
  $inner   = "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location -LiteralPath '$Dir'; $Command"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($inner))
  Start-Process powershell -ArgumentList '-NoExit', '-EncodedCommand', $encoded
}

# --- 1. Prerequis -------------------------------------------------------------

Info 'Verification des prerequis...'

foreach ($cmd in 'docker', 'node', 'npm') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Fail "Commande introuvable : $cmd"
  }
}

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Fail 'Docker ne repond pas. Demarre Docker Desktop, attends qu il soit pret, puis relance le script.'
}

if (-not (Test-Path (Join-Path $Backend '.env'))) {
  Fail "Fichier manquant : $Backend\.env"
}

if (-not (Get-Command whisper -ErrorAction SilentlyContinue)) {
  Warn 'Commande "whisper" introuvable : la transcription audio ne fonctionnera pas.'
}

# --- 2. Base de donnees -------------------------------------------------------

Info 'Demarrage de la base de donnees...'
Push-Location $Root
docker compose up -d
$composeExit = $LASTEXITCODE
Pop-Location
if ($composeExit -ne 0) { Fail 'Echec de "docker compose up -d".' }

Info 'Attente de la base de donnees...'
$status = 'absent'
for ($i = 0; $i -lt 30; $i++) {
  $status = docker inspect -f '{{.State.Health.Status}}' $DbContainer 2>$null
  if ($status -eq 'healthy') { break }
  Start-Sleep -Seconds 2
}

if ($status -ne 'healthy') {
  Fail "La base de donnees n'est pas prete (etat : $status). Voir : docker compose logs postgres"
}
Ok 'Base de donnees prete.'

# --- 3. Dependances npm -------------------------------------------------------

if (-not (Test-Path (Join-Path $Backend 'node_modules'))) {
  Info 'Installation des dependances du backend...'
  Push-Location $Backend
  npm install
  Pop-Location
}

if (-not (Test-Path (Join-Path $Frontend 'node_modules'))) {
  Info 'Installation des dependances du frontend...'
  Push-Location $Frontend
  npm install
  Pop-Location
}

# --- 4. Terminaux backend et frontend -----------------------------------------

if (Test-Url $ApiUrl) {
  Warn 'Le backend tourne deja : aucune nouvelle fenetre ouverte.'
} else {
  Info 'Ouverture du terminal Backend...'
  Open-Terminal 'Veridian - Backend' $Backend 'npm run dev'
}

if (Test-Url $AppUrl) {
  Warn 'Le frontend tourne deja : aucune nouvelle fenetre ouverte.'
} else {
  Info 'Ouverture du terminal Frontend...'
  Open-Terminal 'Veridian - Frontend' $Frontend 'npm run dev'
}

# --- 5. Verification finale ---------------------------------------------------

Info 'Attente des serveurs...'

if (Wait-ForUrl $ApiUrl 30) {
  Ok 'Backend pret  : http://localhost:3000'
} else {
  Warn 'Le backend ne repond pas : regarde la fenetre "Veridian - Backend".'
}

if (Wait-ForUrl $AppUrl 30) {
  Ok "Frontend pret : $AppUrl"
  Start-Process $AppUrl
} else {
  Warn 'Le frontend ne repond pas sur le port 5173 : regarde l adresse affichee dans la fenetre "Veridian - Frontend".'
}

Write-Host ''
Info 'Pour tout arreter : Ctrl+C dans chaque fenetre, puis "docker compose down" a la racine.'
