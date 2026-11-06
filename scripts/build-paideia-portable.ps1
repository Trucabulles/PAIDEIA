param(
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw | ConvertFrom-Json
$version = [string]$package.version
$releaseRoot = Join-Path $projectRoot "src-tauri\target\release"
$portableOutputRoot = Join-Path $projectRoot "artifacts\portable"
$stageName = "PAIDEIA-$version-portable"
$stageRoot = Join-Path $portableOutputRoot $stageName
$archivePath = Join-Path $portableOutputRoot "$stageName.zip"

$resolvedProjectRoot = [System.IO.Path]::GetFullPath($projectRoot).TrimEnd('\')
$resolvedOutputRoot = [System.IO.Path]::GetFullPath($portableOutputRoot).TrimEnd('\')
if (!$resolvedOutputRoot.StartsWith("$resolvedProjectRoot\artifacts\portable", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Dossier de sortie portable invalide : $resolvedOutputRoot"
}

if (!$SkipBuild) {
  & (Join-Path $PSScriptRoot "run-tauri-fixed-webview.ps1") build --no-bundle
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

$executable = Join-Path $releaseRoot "paideia.exe"
$runtimeRoot = Join-Path $projectRoot "src-tauri\webview2-fixed-runtime"
$generatedResources = @("_up_", "resources")

if (!(Test-Path -LiteralPath $executable -PathType Leaf)) {
  throw "Exécutable release introuvable : $executable"
}
if (!(Test-Path -LiteralPath (Join-Path $runtimeRoot "msedgewebview2.exe") -PathType Leaf)) {
  throw "Runtime WebView2 fixe incomplet : $runtimeRoot"
}
New-Item -ItemType Directory -Force -Path $portableOutputRoot | Out-Null
if (Test-Path -LiteralPath $stageRoot) {
  $previousStage = Join-Path $resolvedOutputRoot ("$stageName-backup-" + [guid]::NewGuid().ToString('N'))
  $resolvedStage = [System.IO.Path]::GetFullPath($stageRoot)
  if ((Split-Path -Parent $resolvedStage) -ne $resolvedOutputRoot) { throw 'Dossier portable hors du dossier de sortie.' }
  Move-Item -LiteralPath $resolvedStage -Destination $previousStage
  Write-Host "Version précédente et données conservées : $previousStage"
}
if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}

New-Item -ItemType Directory -Force -Path $stageRoot | Out-Null
Copy-Item -LiteralPath $executable -Destination (Join-Path $stageRoot "PAIDEIA.exe")
Copy-Item -LiteralPath $runtimeRoot -Destination (Join-Path $stageRoot "webview2-fixed-runtime") -Recurse
foreach ($resourceName in $generatedResources) {
  $resourcePath = Join-Path $releaseRoot $resourceName
  if (Test-Path -LiteralPath $resourcePath -PathType Container) {
    Copy-Item -LiteralPath $resourcePath -Destination (Join-Path $stageRoot $resourceName) -Recurse
  }
}
if (Get-ChildItem -LiteralPath $stageRoot -Recurse -Directory -Filter "pdf-a4-runtime" | Select-Object -First 1) {
  throw "Ancien dossier PDF externe présent dans les ressources : nettoyer le build release."
}
Copy-Item -LiteralPath (Join-Path $projectRoot "legal\PAIDEIA-portable-LISEZ-MOI.txt") -Destination (Join-Path $stageRoot "LISEZ-MOI.txt")
if (Get-ChildItem -LiteralPath $stageRoot -Recurse -File -Filter "configuration-collaboration.zip" | Select-Object -First 1) {
  throw "Le build release contient encore le paquet de collaboration. Relancer la compilation sans -SkipBuild."
}

[System.IO.File]::WriteAllText((Join-Path $stageRoot "portable.mode"), "PAIDEIA portable $version`r`n", [System.Text.UTF8Encoding]::new($false))
foreach ($relativeDirectory in @("config", "library", "resources", "logs", "webview")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $stageRoot "data\$relativeDirectory") | Out-Null
}

Compress-Archive -LiteralPath $stageRoot -DestinationPath $archivePath -CompressionLevel Optimal

# Restore personal data only AFTER packaging: the deployment ZIP stays empty.
if ($previousStage -and (Test-Path -LiteralPath (Join-Path $previousStage 'data'))) {
  Get-ChildItem -LiteralPath (Join-Path $previousStage 'data') -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $stageRoot 'data') -Recurse -Force
  }
  Write-Host 'Données personnelles restaurées ; la copie précédente reste disponible.'
}

Write-Host "Archive portable générée : $archivePath"
Write-Host "Le dossier data est isolé de MSI et NSIS par le marqueur portable.mode."
