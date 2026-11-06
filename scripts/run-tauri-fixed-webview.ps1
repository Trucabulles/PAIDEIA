param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet("dev", "build")]
  [string]$Mode,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingArgs
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot "src-tauri\webview2-fixed-runtime"
$tauriCli = Join-Path $projectRoot "node_modules\.bin\tauri.cmd"
$targetRoot = if ($env:CARGO_TARGET_DIR) {
  if ([System.IO.Path]::IsPathRooted($env:CARGO_TARGET_DIR)) {
    $env:CARGO_TARGET_DIR
  } else {
    Join-Path $projectRoot $env:CARGO_TARGET_DIR
  }
} else {
  Join-Path $projectRoot "src-tauri\target"
}
$targetRoot = [System.IO.Path]::GetFullPath($targetRoot)

function Remove-GeneratedWebView2Runtime {
  param([Parameter(Mandatory = $true)][string]$Profile)

  $generatedRuntime = [System.IO.Path]::GetFullPath(
    (Join-Path $targetRoot "$Profile\webview2-fixed-runtime")
  )
  $targetPrefix = $targetRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (!$generatedRuntime.StartsWith($targetPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Chemin de runtime genere hors du dossier target : $generatedRuntime"
  }
  if (Test-Path -LiteralPath $generatedRuntime) {
    Write-Host "Suppression de l'ancienne copie WebView2 generee : $generatedRuntime"
    Remove-Item -LiteralPath $generatedRuntime -Recurse -Force
  }
}

if (!(Test-Path $tauriCli)) {
  throw "CLI Tauri introuvable : $tauriCli"
}

if (!(Test-Path $runtimeRoot)) {
  throw "Runtime WebView2 fixe introuvable : $runtimeRoot"
}

$runtimeExe = Join-Path $runtimeRoot "msedgewebview2.exe"
if (!(Test-Path $runtimeExe)) {
  throw "Le runtime fixe ne contient pas msedgewebview2.exe : $runtimeRoot"
}

$manifest = Get-ChildItem -Path $runtimeRoot -Filter "*.manifest" -File | Select-Object -First 1
$runtimeVersion = if ($manifest) { [System.IO.Path]::GetFileNameWithoutExtension($manifest.Name) } else { "version-inconnue" }

$env:WEBVIEW2_BROWSER_EXECUTABLE_FOLDER = $runtimeRoot

if ($Mode -eq "dev") {
  Remove-GeneratedWebView2Runtime -Profile "debug"
} else {
  $buildProfile = if ($RemainingArgs -contains "--debug") { "debug" } else { "release" }
  Remove-GeneratedWebView2Runtime -Profile $buildProfile
}

Write-Host "PAIDEIA utilise le runtime WebView2 fixe $runtimeVersion"
Write-Host "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER=$runtimeRoot"

Push-Location $projectRoot
try {
  $cliArgs = @($Mode)
  if ($RemainingArgs) { $cliArgs += $RemainingArgs }
  if ($Mode -eq "dev") {
    # Tauri resolves fixedRuntime.path beside the executable and overrides the
    # environment variable. An absolute dev-only override uses the source runtime.
    $devRuntimeConfig = Join-Path $targetRoot "debug\dev-webview-runtime.json"
    $devRuntimePayload = @{ bundle = @{ windows = @{ webviewInstallMode = @{
      type = "fixedRuntime"; path = [System.IO.Path]::GetFullPath($runtimeRoot)
    } } } } | ConvertTo-Json -Depth 8
    [System.IO.File]::WriteAllText($devRuntimeConfig, $devRuntimePayload, [System.Text.UTF8Encoding]::new($false))
    $cliArgs += @("--config", $devRuntimeConfig)
  }
  & $tauriCli @cliArgs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}
