# =============================================================================
# start.ps1 - Demarre l'environnement de developpement Veridian (Windows)
#
# Usage :   powershell -ExecutionPolicy Bypass -File .\start.ps1
#
# Ce que fait le script, dans l'ordre :
#   1. Verifie node et npm
#   2. Demarre Docker Desktop si necessaire et attend qu il soit pret
#   3. Demarre PostgreSQL via docker compose
#   4. Installe les dependances npm si absentes (premier clone)
#   5. Cree le schema puis applique les migrations si la BD est vide (premier clone)
#   6. Ouvre backend et frontend dans deux fenetres separees
#   7. Attend les serveurs et ouvre le navigateur
# =============================================================================

$Root        = $PSScriptRoot
$Backend     = Join-Path $Root 'Projet\Backend'
$Frontend    = Join-Path $Root 'Projet\Frontend'
$DbContainer = 'veridian_db'
$ApiUrl      = 'http://localhost:3000/api/health'
$AppUrl      = 'http://localhost:5173'

# Chemins courants de Docker Desktop sur Windows
$DockerPaths = @(
  "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
  "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
)

function Info($msg) { Write-Host "[Veridian] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[Veridian] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[Veridian] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[Veridian] ERREUR : $msg" -ForegroundColor Red; exit 1 }

function Test-Url($url) {
  try {
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch { return $false }
}

function Wait-ForUrl($url, $tries) {
  for ($i = 0; $i -lt $tries; $i++) {
    if (Test-Url $url) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Open-Terminal($title, $dir, $command) {
  $inner   = "`$Host.UI.RawUI.WindowTitle = '$title'; Set-Location -LiteralPath '$dir'; $command"
  $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($inner))
  Start-Process powershell -ArgumentList '-NoExit', '-EncodedCommand', $encoded
}

# =============================================================================
# 1. Prerequis de base
# =============================================================================

Info 'Verification des prerequis...'

foreach ($cmd in 'node', 'npm') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Fail "$cmd est introuvable. Installe Node.js depuis https://nodejs.org"
  }
}

$nodeVersion = (node --version) -replace 'v', ''
$nodeMajor   = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 18) {
  Fail "Node.js $nodeVersion detecte. Veridian requiert Node.js 18 ou plus."
}
Ok "Node.js v$nodeVersion"

if (-not (Test-Path (Join-Path $Backend '.env'))) {
  Warn "Fichier $Backend\.env manquant."
  Warn "Copie $Backend\.env.example vers $Backend\.env et remplis les valeurs."
  Fail "Fichier .env absent — impossible de demarrer."
}

if (-not (Get-Command whisper -ErrorAction SilentlyContinue)) {
  Warn '"whisper" introuvable : la transcription audio ne fonctionnera pas.'
  Warn 'Pour installer : pip install openai-whisper'
}

# =============================================================================
# 2. Docker Desktop
# =============================================================================

Info 'Verification de Docker...'

# Teste si Docker repond deja
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Info 'Docker ne repond pas. Tentative de demarrage de Docker Desktop...'

  $dockerExe = $DockerPaths | Where-Object { Test-Path $_ } | Select-Object -First 1

  if (-not $dockerExe) {
    Fail "Docker Desktop est introuvable. Installe-le depuis https://www.docker.com/products/docker-desktop"
  }

  Start-Process $dockerExe
  Info 'Docker Desktop demarre. Attente (peut prendre 30-60 secondes)...'

  $dockerReady = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerReady = $true; break }
    if ($i % 5 -eq 0) { Info "  ...attente de Docker ($($i*2)s)" }
  }

  if (-not $dockerReady) {
    Fail "Docker Desktop ne repond toujours pas apres 120s. Lance-le manuellement et relance le script."
  }
}

Ok 'Docker pret.'

# =============================================================================
# 3. Base de donnees PostgreSQL
# =============================================================================

Info 'Demarrage de la base de donnees...'
Push-Location $Root
docker compose up -d
$exitCode = $LASTEXITCODE
Pop-Location

if ($exitCode -ne 0) { Fail 'Echec de "docker compose up -d". Voir les logs ci-dessus.' }

Info 'Attente que PostgreSQL soit pret...'
$dbStatus = 'absent'
for ($i = 0; $i -lt 30; $i++) {
  $dbStatus = docker inspect -f '{{.State.Health.Status}}' $DbContainer 2>$null
  if ($dbStatus -eq 'healthy') { break }
  Start-Sleep -Seconds 2
}

if ($dbStatus -ne 'healthy') {
  Fail "PostgreSQL pas pret (etat : $dbStatus). Voir les logs : docker compose logs postgres"
}
Ok 'Base de donnees prete.'

# =============================================================================
# 4. Dependances npm (premier clone ou apres git pull)
# =============================================================================

if (-not (Test-Path (Join-Path $Backend 'node_modules'))) {
  Info 'Installation des dependances backend (premier demarrage)...'
  Push-Location $Backend
  npm install
  if ($LASTEXITCODE -ne 0) { Fail 'npm install a echoue dans Backend.' }
  Pop-Location
  Ok 'Dependances backend installees.'
}

if (-not (Test-Path (Join-Path $Frontend 'node_modules'))) {
  Info 'Installation des dependances frontend (premier demarrage)...'
  Push-Location $Frontend
  npm install
  if ($LASTEXITCODE -ne 0) { Fail 'npm install a echoue dans Frontend.' }
  Pop-Location
  Ok 'Dependances frontend installees.'
}

# =============================================================================
# 5. Initialisation de la base de donnees (premier clone seulement)
# =============================================================================

# Applique un fichier SQL dans le conteneur. On copie le fichier dans le
# conteneur puis on le lit avec "psql -f" : cela evite l'operateur "<"
# (non supporte par PowerShell) et les problemes d'encodage d'un "pipe".
# -v ON_ERROR_STOP=1 : la premiere erreur SQL arrete tout au lieu de continuer.
function Invoke-SqlFile($file) {
  $name = Split-Path $file -Leaf
  docker cp $file "${DbContainer}:/tmp/$name"
  if ($LASTEXITCODE -ne 0) { Fail "Copie de $name dans le conteneur impossible." }
  docker exec $DbContainer psql -v ON_ERROR_STOP=1 -q -U veridian_user -d veridian -f "/tmp/$name"
  if ($LASTEXITCODE -ne 0) { Fail "Echec de l'application de $name (voir l'erreur SQL ci-dessus)." }
}

# Verifie si la table "users" existe - si non, c'est un premier clone
$tableExists = docker exec $DbContainer psql -U veridian_user -d veridian -tAc `
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users');" 2>$null

if ($tableExists -ne 't') {
  Info 'Base de donnees vide detectee. Creation du schema...'

  # Ordre obligatoire : le schema de base d'abord, puis les migrations
  # (les migrations modifient ou referencent les tables du schema).
  $SchemaFile = Join-Path $Backend 'database\schema.sql'
  if (-not (Test-Path $SchemaFile)) { Fail "Fichier schema.sql introuvable : $SchemaFile" }
  Info '  Schema : schema.sql'
  Invoke-SqlFile $SchemaFile

  $MigrationsDir = Join-Path $Backend 'database\migrations'
  if (Test-Path $MigrationsDir) {
    $sqlFiles = Get-ChildItem -Path $MigrationsDir -Filter '*.sql' | Sort-Object Name
    foreach ($file in $sqlFiles) {
      Info "  Migration : $($file.Name)"
      Invoke-SqlFile $file.FullName
    }
  }
  Ok 'Schema et migrations appliques.'
} else {
  Ok 'Base de donnees deja initialisee.'
}

# =============================================================================
# 6. Backend et Frontend
# =============================================================================

if (Test-Url $ApiUrl) {
  Warn 'Backend deja demarre : aucune nouvelle fenetre ouverte.'
} else {
  Info 'Ouverture du terminal Backend...'
  Open-Terminal 'Veridian - Backend' $Backend 'npm run dev'
}

if (Test-Url $AppUrl) {
  Warn 'Frontend deja demarre : aucune nouvelle fenetre ouverte.'
} else {
  Info 'Ouverture du terminal Frontend...'
  Open-Terminal 'Veridian - Frontend' $Frontend 'npm run dev'
}

# =============================================================================
# 7. Attente et ouverture du navigateur
# =============================================================================

Info 'Attente des serveurs...'

if (Wait-ForUrl $ApiUrl 30) {
  Ok 'Backend pret  : http://localhost:3000'
} else {
  Warn 'Le backend ne repond pas encore. Regarde la fenetre "Veridian - Backend".'
}

if (Wait-ForUrl $AppUrl 30) {
  Ok "Frontend pret : $AppUrl"
  Start-Process $AppUrl
} else {
  Warn 'Le frontend ne repond pas sur le port 5173. Regarde la fenetre "Veridian - Frontend".'
}

Write-Host ''
Ok '============================================================'
Ok '  Veridian est pret !'
Ok '  Frontend : http://localhost:5173'
Ok '  Backend  : http://localhost:3000'
Ok '  BD       : localhost:5432 (via Docker)'
Ok '============================================================'
Write-Host ''
Info 'Pour tout arreter : Ctrl+C dans chaque fenetre, puis :'
Info '  docker compose down    (arrete PostgreSQL)'
Info '  docker compose down -v (arrete + supprime les donnees)'
