# Comment exécuter ce script depuis PowerShell :
# cd "$HOME\tile-browser"
# .\build-linux.ps1
# ----------------------------------------------
# Arrêter le script en cas d'erreur
$ErrorActionPreference = "Stop"

$SERVER = "ubuntu@129.151.254.175"
$KEY = "$HOME\.ssh\oracle_searxng"
$PROJECT_DIR = "$HOME\tile-browser"
$ARCHIVE = "$HOME\tile-browser.tar.gz"
$DOWNLOADS = "$HOME\Downloads"

Write-Host "=== 1. Compression des sources necessaires ===" -ForegroundColor Cyan
Set-Location $PROJECT_DIR
if (Test-Path $ARCHIVE) { Remove-Item $ARCHIVE -Force }
tar --exclude="node_modules" --exclude="dist" --exclude=".git" --exclude="ollama-bundle" --exclude="OLD" --exclude="videos" -czf $ARCHIVE .

Write-Host "=== 2. Envoi vers le serveur Ubuntu ===" -ForegroundColor Cyan
scp -i $KEY $ARCHIVE "${SERVER}:~/"
Remove-Item $ARCHIVE -Force

Write-Host "=== 3. Extraction et compilation Linux sur le serveur ===" -ForegroundColor Cyan
# Installe les dependances uniquement si node_modules est absent ou si package-lock.json a change
$REMOTE_CMD = "set -e && mkdir -p ~/tile-browser && tar -xzf ~/tile-browser.tar.gz -C ~/tile-browser && rm -f ~/tile-browser.tar.gz && cd ~/tile-browser && npm install --prefer-offline --no-audit && rm -rf dist && npm run dist:linux"
ssh -i $KEY $SERVER $REMOTE_CMD

Write-Host "=== 4. Rapatriement des binaires dans Telechargements ===" -ForegroundColor Cyan
try {
    Remove-Item "$DOWNLOADS\Hare-Browser-1.0.3-*" -Force -ErrorAction Stop
} catch {
    Write-Warning "Impossible de supprimer un ancien fichier (peut-etre verrouille par VirtualBox) : $_"
}
scp -i $KEY "${SERVER}:~/tile-browser/dist/Hare-Browser-*" $DOWNLOADS

Write-Host "=== Termine ! Les fichiers sont prets dans $DOWNLOADS ===" -ForegroundColor Green
