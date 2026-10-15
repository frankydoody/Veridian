# =============================================================================
# start.ps1 - Installe (si necessaire) et demarre Veridian sur Windows
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File .\start.ps1
#
# Options :
#   -SkipWhisper   n'installe pas Python / ffmpeg / Whisper (pas de transcription audio)
#   -InstallOnly   installe et prepare tout, mais ne lance pas les serveurs
#
# Le script fonctionne sur un PC sur lequel RIEN n'est installe : il installe
# ce qui manque (via winget), et ne touche pas a ce qui est deja present.
# Il peut etre relance autant de fois que necessaire : chaque etape verifie
# d'abord son etat et ne fait que le travail manquant.
#
# Ce que fait le script, dans l'ordre :
#   1. Verifie winget (le gestionnaire de paquets de Windows)
#   2. Installe Node.js (LTS), Docker Desktop, et - sauf -SkipWhisper - Python,
#      ffmpeg et Whisper, seulement s'ils manquent
#   3. Cree Projet\Backend\.env (secret JWT genere) et complete les cles manquantes
#   4. Installe les dependances npm (premier clone, ou apres un git pull)
#   5. Demarre Docker Desktop puis PostgreSQL (docker compose)
#   6. Cree le schema de la base, puis applique les migrations non encore appliquees
#   7. Ouvre le backend et le frontend dans deux fenetres, puis le navigateur
#
# NOTE : ce fichier ne contient volontairement que des caracteres ASCII, pour
# etre lu correctement par Windows PowerShell 5.1 quel que soit l'encodage.
# =============================================================================

param(
  [switch]$SkipWhisper,
  [switch]$InstallOnly
)

# 'Continue' : les erreurs des commandes natives (docker, winget...) sont testees via $LASTEXITCODE
$ErrorActionPreference = 'Continue'

$Root         = $PSScriptRoot
$Backend      = Join-Path $Root 'Projet\Backend'
$Frontend     = Join-Path $Root 'Projet\Frontend'
$EnvFile      = Join-Path $Backend '.env'
$DbContainer  = 'veridian_db'
$DbUser       = 'veridian_user'
$DbName       = 'veridian'
$ApiUrl       = 'http://localhost:3000/api/health'
$AppUrl       = 'http://localhost:5173'
$NodeMinMajor = 20

# Chemins courants de Docker Desktop sur Windows
$DockerPaths = @(
  "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
  "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
)

# Valeurs par defaut du fichier .env (aucun secret : le secret JWT est genere,
# la cle Gemini est demandee). Les valeurs de base de donnees doivent
# correspondre a docker-compose.yml.
$EnvDefaults = [ordered]@{
  PORT             = '3000'
  DB_HOST          = 'localhost'
  DB_PORT          = '5432'
  DB_NAME          = 'veridian'
  DB_USER          = 'veridian_user'
  DB_PASSWORD      = 'veridian_pass'
  JWT_EXPIRES_IN   = '7d'
  AI_PROVIDER      = 'gemini'
  AI_MODEL         = 'gemini-2.5-flash'
  WHISPER_MODE     = 'local'
  WHISPER_MODEL    = 'small'
  WHISPER_LANGUAGE = 'fr'
}

# -----------------------------------------------------------------------------
# Affichage
# -----------------------------------------------------------------------------

function Info($msg) { Write-Host "[Veridian] $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "[Veridian] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[Veridian] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[Veridian] ERREUR : $msg" -ForegroundColor Red; exit 1 }

# -----------------------------------------------------------------------------
# Utilitaires
# -----------------------------------------------------------------------------

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

# Retourne $true si la commande existe (et n'est pas le faux "python" du Microsoft Store)
function Test-Command($name) {
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { return $false }
  if ($cmd.Source -and $cmd.Source -like '*\WindowsApps\*' -and $name -like 'python*') { return $false }
  return $true
}

# Apres une installation, le PATH de CETTE fenetre n'est pas mis a jour : on le
# recharge depuis le registre (PATH machine + PATH utilisateur).
function Update-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

# Ajoute un dossier au PATH de l'utilisateur (permanent) et de la session, s'il n'y est pas deja
function Add-ToUserPath($dir) {
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $parts = @()
  if ($user) { $parts = $user.Split(';') | Where-Object { $_ } }
  if ($parts -notcontains $dir) {
    [Environment]::SetEnvironmentVariable('Path', (($parts + $dir) -join ';'), 'User')
  }
  if (($env:Path.Split(';')) -notcontains $dir) { $env:Path = "$env:Path;$dir" }
}

# Extrait le numero majeur d'une version ("v20.11.1" -> 20 ; "Python 3.12.4" -> 3)
function Get-MajorVersion($text) {
  if ($text -match '(\d+)\.\d+') { return [int]$Matches[1] }
  return 0
}

# Installe un paquet avec winget (accepte les licences, sans interaction).
# winget affiche lui-meme la demande d'autorisation Windows (UAC) si necessaire.
function Install-WithWinget($id, $label) {
  Info "Installation de $label (winget : $id)..."
  & winget install --id $id --exact --silent --accept-package-agreements --accept-source-agreements
  # Codes de retour "deja installe / aucune mise a jour" : pas une erreur
  $alreadyOk = @(0, -1978335189, -1978335135)
  if ($alreadyOk -notcontains $LASTEXITCODE) {
    Fail "L'installation de $label a echoue (code $LASTEXITCODE). Installe-le manuellement puis relance le script."
  }
  Update-SessionPath
}

# -----------------------------------------------------------------------------
# Fichier .env
# -----------------------------------------------------------------------------

function New-RandomSecret {
  $bytes = New-Object byte[] 48
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  $rng.Dispose()
  return ([Convert]::ToBase64String($bytes)).Replace('+', '-').Replace('/', '_').TrimEnd('=')
}

# Lit un .env en table { cle = valeur } (ignore les commentaires et lignes vides)
function Read-EnvFile($path) {
  $values = @{}
  if (Test-Path $path) {
    foreach ($line in Get-Content -LiteralPath $path) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') { $values[$Matches[1]] = $Matches[2].Trim() }
    }
  }
  return $values
}

# Ajoute "CLE=valeur" a la fin du fichier si la cle est absente ou vide.
# Ne modifie JAMAIS une valeur deja renseignee.
function Set-EnvKeyIfMissing($path, $key, $value) {
  $current = Read-EnvFile $path
  if ($current.ContainsKey($key) -and $current[$key] -ne '') { return $false }
  # Si le fichier ne se termine pas par un saut de ligne, on en ajoute un avant d'ecrire
  if ((Test-Path -LiteralPath $path) -and (([IO.FileInfo]$path).Length -gt 0)) {
    $raw = [IO.File]::ReadAllText($path)
    if (-not $raw.EndsWith("`n")) { [IO.File]::AppendAllText($path, [Environment]::NewLine) }
  }
  if ($current.ContainsKey($key)) {
    # cle presente mais vide : on remplace la ligne
    $lines = Get-Content -LiteralPath $path | ForEach-Object {
      if ($_ -match "^\s*$key\s*=") { "$key=$value" } else { $_ }
    }
    Set-Content -LiteralPath $path -Value $lines -Encoding ASCII
  } else {
    Add-Content -LiteralPath $path -Value "$key=$value" -Encoding ASCII
  }
  return $true
}

function Initialize-EnvFile {
  $isNew = -not (Test-Path $EnvFile)
  if ($isNew) {
    Info 'Fichier Projet\Backend\.env absent : creation avec les valeurs par defaut...'
    New-Item -ItemType File -Path $EnvFile -Force | Out-Null
  }

  $added = @()
  foreach ($key in $EnvDefaults.Keys) {
    if (Set-EnvKeyIfMissing $EnvFile $key $EnvDefaults[$key]) { $added += $key }
  }
  if (Set-EnvKeyIfMissing $EnvFile 'JWT_SECRET' (New-RandomSecret)) { $added += 'JWT_SECRET (genere)' }

  # Cle Gemini : indispensable pour l'IA (decisions, memoire, chat). Demandee une seule fois.
  $values = Read-EnvFile $EnvFile
  if (-not $values.ContainsKey('GEMINI_API_KEY') -or $values['GEMINI_API_KEY'] -eq '') {
    $key = ''
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
      Write-Host ''
      Write-Host '  Une cle API Gemini est necessaire pour les fonctions d''IA.' -ForegroundColor Yellow
      Write-Host '  Gratuite : https://aistudio.google.com/apikey  (laisse vide pour l''ajouter plus tard)' -ForegroundColor Yellow
      $key = (Read-Host '  Cle API Gemini').Trim()
    }
    if ($key -ne '') {
      Set-EnvKeyIfMissing $EnvFile 'GEMINI_API_KEY' $key | Out-Null
      $added += 'GEMINI_API_KEY'
    } elseif (-not $values.ContainsKey('GEMINI_API_KEY')) {
      Add-Content -LiteralPath $EnvFile -Value 'GEMINI_API_KEY=' -Encoding ASCII
      Warn 'Aucune cle Gemini : l''application demarre, mais l''IA ne fonctionnera pas.'
      Warn "Ajoute-la plus tard dans $EnvFile (ligne GEMINI_API_KEY=...) puis redemarre le backend."
    } else {
      Warn "GEMINI_API_KEY est vide dans $EnvFile : l'IA ne fonctionnera pas tant qu'elle n'est pas renseignee."
    }
  }

  if ($added.Count -gt 0) { Ok ("Fichier .env complete : " + ($added -join ', ')) }
  else { Ok 'Fichier .env deja complet.' }
}

# -----------------------------------------------------------------------------
# Prerequis
# -----------------------------------------------------------------------------

function Confirm-Winget {
  if (Test-Command 'winget') { return }
  Fail ("winget (Gestionnaire de paquets Windows) est introuvable. Installe ""Programme d'installation d'application"" " +
        "depuis le Microsoft Store (ou mets Windows a jour), puis relance ce script.")
}

function Confirm-Node {
  $ok = $false
  if (Test-Command 'node') {
    $ok = (Get-MajorVersion (& node --version)) -ge $NodeMinMajor
  }
  if ($ok) {
    Ok "Node.js $(& node --version) deja installe."
    return
  }
  if (Test-Command 'node') { Warn "Node.js $(& node --version) est trop ancien (version $NodeMinMajor ou plus requise)." }
  Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js (LTS)'
  if (-not (Test-Command 'node') -or (Get-MajorVersion (& node --version)) -lt $NodeMinMajor) {
    Fail 'Node.js n''est pas utilisable apres l''installation. Ferme cette fenetre, ouvre-en une nouvelle et relance le script.'
  }
  Ok "Node.js $(& node --version) installe."
}

function Confirm-DockerInstalled {
  if (Test-Command 'docker') {
    Ok 'Docker Desktop deja installe.'
    return
  }
  Install-WithWinget 'Docker.DockerDesktop' 'Docker Desktop'
  Update-SessionPath
  if (-not (Test-Command 'docker')) {
    Warn 'Docker Desktop est installe, mais Windows doit probablement etre redemarre (WSL2 / virtualisation).'
    Warn 'Redemarre le PC, lance Docker Desktop une premiere fois (accepte les conditions), puis relance start.ps1.'
    exit 0
  }
  Ok 'Docker Desktop installe.'
}

# Python 3.9 a 3.12 (versions prises en charge par Whisper). Retourne la commande a utiliser, ou $null.
function Find-Python {
  foreach ($v in '3.12', '3.11', '3.10', '3.9') {
    if (Test-Command 'py') {
      & py "-$v" --version 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) { return @('py', "-$v") }
    }
  }
  if (Test-Command 'python') {
    $txt = (& python --version 2>&1) | Out-String
    if ($txt -match 'Python 3\.(\d+)') {
      $minor = [int]$Matches[1]
      if ($minor -ge 9 -and $minor -le 12) { return @('python') }
    }
  }
  return $null
}

function Confirm-Whisper {
  if ($SkipWhisper) {
    Warn 'Option -SkipWhisper : Python, ffmpeg et Whisper ne sont pas installes (pas de transcription audio).'
    return
  }

  # --- Python
  $py = Find-Python
  if (-not $py) {
    Install-WithWinget 'Python.Python.3.12' 'Python 3.12'
    $py = Find-Python
    if (-not $py) { Fail 'Python est introuvable apres l''installation. Ferme cette fenetre, ouvre-en une nouvelle et relance le script.' }
  }
  $pyExe  = $py[0]
  $pyArgs = @()
  if ($py.Count -gt 1) { $pyArgs = @($py[1..($py.Count - 1)]) }
  Ok "Python deja disponible ($($py -join ' '))."

  # --- ffmpeg (requis par Whisper pour lire l'audio)
  if (Test-Command 'ffmpeg') { Ok 'ffmpeg deja installe.' }
  else {
    Install-WithWinget 'Gyan.FFmpeg' 'ffmpeg'
    if (-not (Test-Command 'ffmpeg')) { Warn 'ffmpeg est installe mais pas encore visible : ouvre une nouvelle fenetre PowerShell si la transcription echoue.' }
  }

  # --- Whisper (paquet pip "openai-whisper", commande "whisper")
  if (Test-Command 'whisper') {
    Ok 'Whisper deja installe.'
    return
  }
  & $pyExe @pyArgs -m pip show openai-whisper 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Info 'Installation de Whisper (pip install openai-whisper) - plusieurs Go a telecharger, patience...'
    & $pyExe @pyArgs -m pip install --upgrade pip 2>&1 | Out-Null
    & $pyExe @pyArgs -m pip install openai-whisper
    if ($LASTEXITCODE -ne 0) {
      Warn 'L''installation de Whisper a echoue : la transcription audio ne fonctionnera pas.'
      Warn 'Tu peux relancer le script plus tard, ou utiliser -SkipWhisper pour ignorer cette etape.'
      return
    }
  }
  # La commande "whisper" est dans le dossier Scripts de Python : on s'assure qu'il est dans le PATH
  $scripts = (& $pyExe @pyArgs -c "import sysconfig; print(sysconfig.get_path('scripts'))" 2>$null | Out-String).Trim()
  if ($scripts -and (Test-Path $scripts)) { Add-ToUserPath $scripts }
  Update-SessionPath
  if (Test-Command 'whisper') { Ok 'Whisper pret.' }
  else { Warn 'Whisper est installe mais la commande "whisper" n''est pas encore visible : ouvre une nouvelle fenetre PowerShell.' }
}

# -----------------------------------------------------------------------------
# Dependances npm
# -----------------------------------------------------------------------------

# Installe les dependances si node_modules est absent, ou si package-lock.json
# est plus recent que la derniere installation (apres un git pull, par exemple).
function Confirm-NpmDependencies($dir, $label) {
  $modules = Join-Path $dir 'node_modules'
  $stamp   = Join-Path $modules '.package-lock.json'
  $lock    = Join-Path $dir 'package-lock.json'
  $needed  = $false

  if (-not (Test-Path $modules) -or -not (Test-Path $stamp)) { $needed = $true }
  elseif ((Test-Path $lock) -and ((Get-Item -Force $lock).LastWriteTime -gt (Get-Item -Force $stamp).LastWriteTime)) { $needed = $true }

  if (-not $needed) {
    Ok "Dependances $label a jour."
    return
  }
  Info "Installation des dependances $label..."
  Push-Location $dir
  try {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Fail "npm install a echoue dans $label." }
  } finally { Pop-Location }
  Ok "Dependances $label installees."
}

# -----------------------------------------------------------------------------
# Docker et base de donnees
# -----------------------------------------------------------------------------

function Start-DockerDesktop {
  Info 'Verification de Docker...'
  & docker info 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok 'Docker pret.'; return }

  Info 'Docker ne repond pas. Demarrage de Docker Desktop...'
  $dockerExe = $DockerPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $dockerExe) {
    Fail 'Docker Desktop est introuvable. Relance le script (il l''installera) ou installe-le depuis https://www.docker.com/products/docker-desktop'
  }
  Start-Process $dockerExe
  Info 'Attente de Docker Desktop (jusqu''a 3 minutes ; la premiere fois, accepte les conditions d''utilisation dans sa fenetre)...'

  for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 2
    & docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok 'Docker pret.'; return }
    if ($i % 10 -eq 0 -and $i -gt 0) { Info "  ...attente de Docker ($($i * 2)s)" }
  }
  Fail 'Docker Desktop ne repond toujours pas. Termine son demarrage (conditions, WSL2, redemarrage si demande), puis relance le script.'
}

function Start-Database {
  Info 'Demarrage de la base de donnees...'
  Push-Location $Root
  try {
    & docker compose up -d
    if ($LASTEXITCODE -ne 0) { Fail 'Echec de "docker compose up -d". Voir les messages ci-dessus.' }
  } finally { Pop-Location }

  Info 'Attente que PostgreSQL soit pret...'
  $dbStatus = 'absent'
  for ($i = 0; $i -lt 30; $i++) {
    $dbStatus = (& docker inspect -f '{{.State.Health.Status}}' $DbContainer 2>$null | Out-String).Trim()
    if ($dbStatus -eq 'healthy') { break }
    Start-Sleep -Seconds 2
  }
  if ($dbStatus -ne 'healthy') {
    Fail "PostgreSQL n'est pas pret (etat : $dbStatus). Voir : docker compose logs postgres"
  }
  Ok 'Base de donnees prete.'
}

# Execute une requete SQL dans le conteneur et retourne sa sortie (sans en-tetes)
function Invoke-Sql($sql) {
  $out = & docker exec $DbContainer psql -U $DbUser -d $DbName -tAc $sql 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return ($out | Out-String).Trim()
}

# Applique un fichier SQL dans le conteneur. On copie le fichier dans le
# conteneur puis on le lit avec "psql -f" : cela evite l'operateur "<"
# (non supporte par PowerShell) et les problemes d'encodage d'un "pipe".
# -v ON_ERROR_STOP=1 : la premiere erreur SQL arrete tout au lieu de continuer.
function Invoke-SqlFile($file) {
  $name = Split-Path $file -Leaf
  & docker cp $file "${DbContainer}:/tmp/$name"
  if ($LASTEXITCODE -ne 0) { Fail "Copie de $name dans le conteneur impossible." }
  & docker exec -e PGOPTIONS=--client-min-messages=warning $DbContainer psql -v ON_ERROR_STOP=1 -q -U $DbUser -d $DbName -f "/tmp/$name"
  if ($LASTEXITCODE -ne 0) { Fail "Echec de l'application de $name (voir l'erreur SQL ci-dessus)." }
}

# Cree le schema si la base est vide, puis applique les migrations pas encore
# appliquees. Les migrations appliquees sont memorisees dans la table
# schema_migrations : relancer le script ne rejoue jamais une migration, et une
# nouvelle migration ajoutee par un git pull est appliquee automatiquement.
function Initialize-Database {
  $hasUsers = Invoke-Sql "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users');"

  if ($hasUsers -ne 't') {
    Info 'Base de donnees vide detectee. Creation du schema...'
    $schemaFile = Join-Path $Backend 'database\schema.sql'
    if (-not (Test-Path $schemaFile)) { Fail "Fichier schema.sql introuvable : $schemaFile" }
    Info '  Schema : schema.sql'
    Invoke-SqlFile $schemaFile
  } else {
    Ok 'Schema de base deja present.'
  }

  Invoke-Sql 'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());' | Out-Null

  $migrationsDir = Join-Path $Backend 'database\migrations'
  $applied = 0
  if (Test-Path $migrationsDir) {
    foreach ($file in (Get-ChildItem -Path $migrationsDir -Filter '*.sql' | Sort-Object Name)) {
      $already = Invoke-Sql "SELECT 1 FROM schema_migrations WHERE name = '$($file.Name)';"
      if ($already -eq '1') { continue }
      Info "  Migration : $($file.Name)"
      Invoke-SqlFile $file.FullName
      Invoke-Sql "INSERT INTO schema_migrations (name) VALUES ('$($file.Name)') ON CONFLICT DO NOTHING;" | Out-Null
      $applied++
    }
  }
  if ($applied -gt 0) { Ok "$applied migration(s) appliquee(s)." }
  else { Ok 'Base de donnees a jour (aucune migration a appliquer).' }
}

# -----------------------------------------------------------------------------
# Lancement
# -----------------------------------------------------------------------------

function Start-Servers {
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

  Info 'Attente des serveurs...'
  if (Wait-ForUrl $ApiUrl 30) { Ok 'Backend pret  : http://localhost:3000' }
  else { Warn 'Le backend ne repond pas encore. Regarde la fenetre "Veridian - Backend".' }

  if (Wait-ForUrl $AppUrl 30) {
    Ok "Frontend pret : $AppUrl"
    Start-Process $AppUrl
  } else {
    Warn 'Le frontend ne repond pas sur le port 5173. Regarde la fenetre "Veridian - Frontend".'
  }
}

# -----------------------------------------------------------------------------
# Programme principal
# -----------------------------------------------------------------------------

function Main {
  Write-Host ''
  Info 'Veridian - installation et demarrage'
  Write-Host ''

  Confirm-Winget
  Confirm-Node
  Confirm-DockerInstalled
  Confirm-Whisper

  Initialize-EnvFile

  Confirm-NpmDependencies $Backend  'backend'
  Confirm-NpmDependencies $Frontend 'frontend'

  Start-DockerDesktop
  Start-Database
  Initialize-Database

  if ($InstallOnly) {
    Write-Host ''
    Ok 'Installation terminee (option -InstallOnly : les serveurs ne sont pas lances).'
    Ok 'Pour demarrer : powershell -ExecutionPolicy Bypass -File .\start.ps1'
    return
  }

  Start-Servers

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
}

# Permet de charger les fonctions sans lancer l'installation (tests) :
#   $env:VERIDIAN_NO_MAIN = '1'; . .\start.ps1
if (-not $env:VERIDIAN_NO_MAIN) { Main }
