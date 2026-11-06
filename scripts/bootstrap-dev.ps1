param(
  [switch]$Install,
  [switch]$RunChecks
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Test-CommandAvailable {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    Write-Host "[MANQUANT] $Name" -ForegroundColor Red
    return $false
  }
  Write-Host "[OK] $Name -> $($command.Source)" -ForegroundColor Green
  return $true
}

function Invoke-Logged {
  param(
    [string]$Label,
    [string]$FilePath,
    [string[]]$Arguments = @()
  )
  Write-Section $Label
  & $FilePath @Arguments
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

Write-Host "PAIDEIA - reprise environnement developpeur" -ForegroundColor Cyan
Write-Host "Racine detectee : $repoRoot"

Write-Section "Outils requis"
$hasGit = Test-CommandAvailable "git"
$hasNode = Test-CommandAvailable "node"
$hasNpm = Test-CommandAvailable "npm"
$hasRustc = Test-CommandAvailable "rustc"
$hasCargo = Test-CommandAvailable "cargo"

Write-Section "Versions detectees"
if ($hasGit) { git --version }
if ($hasNode) { node --version }
if ($hasNpm) { npm --version }
if ($hasRustc) { rustc --version }
if ($hasCargo) { cargo --version }

Write-Section "Fichiers critiques"
$criticalPaths = @(
  "package.json",
  "src-tauri/Cargo.toml",
  "src-tauri/tauri.conf.json",
  "scripts/run-tauri-fixed-webview.ps1",
  "public/default-characters",
  "legal/pdfmake-LICENSE.txt",
  "src-tauri/webview2-fixed-runtime"
)

foreach ($path in $criticalPaths) {
  if (Test-Path -LiteralPath $path) {
    Write-Host "[OK] $path" -ForegroundColor Green
  } else {
    Write-Host "[MANQUANT] $path" -ForegroundColor Red
  }
}

Write-Section "Etat Git"
if ($hasGit) {
  git status --short
} else {
  Write-Host "Git indisponible : impossible de lire l'etat du depot." -ForegroundColor Yellow
}

if ($Install) {
  if (-not $hasNpm) {
    throw "npm est requis pour executer -Install."
  }
  Invoke-Logged "Installation npm" "npm" @("install")
} else {
  Write-Section "Installation npm"
  if (Test-Path -LiteralPath "node_modules") {
    Write-Host "[OK] node_modules existe."
  } else {
    Write-Host "node_modules absent. Lancer : npm install" -ForegroundColor Yellow
  }
}

if ($RunChecks) {
  if (-not $hasNpm) {
    throw "npm est requis pour executer les controles frontend."
  }
  if (-not $hasCargo) {
    throw "cargo est requis pour executer cargo check."
  }
  Invoke-Logged "Build frontend" "npm" @("run", "build")
  Invoke-Logged "Contrat modele PDF" "npm" @("run", "test:pdf-model")
  Push-Location "src-tauri"
  try {
    Invoke-Logged "Cargo check" "cargo" @("check")
  } finally {
    Pop-Location
  }
} else {
  Write-Section "Controles recommandes"
  Write-Host "npm run build"
  Write-Host "npm run test:pdf-model"
  Write-Host "cd src-tauri; cargo check; cd .."
}

Write-Section "Lancement developpement"
Write-Host "npm run tauri:dev"

Write-Host ""
Write-Host "Bootstrap termine." -ForegroundColor Green
