# Efesto: instalación completa en un clic para Windows.
# Comprueba/instala Git, Node.js 22+, Python 3.14 y Ollama (winget), instala Hermes Agent con búsqueda
# DuckDuckGo, descarga qwen3.5:2b, compila Efesto (install-efesto.ps1 + panel), crea los accesos
# "Iniciar Efesto" y "Detener Efesto" y arranca Kernel :4310, panel :3311 y el trabajador de Hermes.
# Se puede volver a ejecutar sin riesgo: lo que ya está bien se deja como está.
param(
  [switch]$DryRun,
  [switch]$SkipShortcuts,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $RepoRoot

# Hermes Agent pinned to the revision Efesto is validated with (box: ae3f9f9c).
$HermesRepo = 'https://github.com/NousResearch/hermes-agent.git'
$HermesRevision = 'ae3f9f9c'
$Model = 'qwen3.5:2b'
$HermesRoot = Join-Path $env:LOCALAPPDATA 'hermes\hermes-agent'
$HermesExe = Join-Path $HermesRoot 'venv\Scripts\hermes.exe'

$script:StepNumber = 0
$TotalSteps = 9
function Write-Step([string]$Message) {
  $script:StepNumber++
  Write-Host ''
  Write-Host "[Efesto] Paso $($script:StepNumber) de ${TotalSteps}: $Message" -ForegroundColor Cyan
}
function Write-Info([string]$Message) { Write-Host "          $Message" }
function Write-Ok([string]$Message) { Write-Host "          OK: $Message" -ForegroundColor Green }

function Refresh-ProcessPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = @($machine, $user) -join ';'
  $ollamaDir = Join-Path $env:LOCALAPPDATA 'Programs\Ollama'
  if (Test-Path $ollamaDir) { $env:Path = "$env:Path;$ollamaDir" }
}
function Test-Command([string]$Name) { return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue) }

function Install-WithWinget([string]$Id, [string]$Name) {
  if ($DryRun) { Write-Info "(simulación) winget install --id $Id"; return }
  if (-not (Test-Command 'winget')) {
    throw "Falta $Name y este equipo no tiene winget (Instalador de aplicaciones de Microsoft). Instala 'App Installer' desde Microsoft Store y vuelve a ejecutar."
  }
  Write-Info "Instalando $Name con winget (puede tardar unos minutos)..."
  & winget install --id $Id --exact --accept-package-agreements --accept-source-agreements --silent
  if ($LASTEXITCODE -ne 0) { throw "winget no pudo instalar $Name (código $LASTEXITCODE)." }
  Refresh-ProcessPath
}

function Get-NodeMajor {
  if (-not (Test-Command 'node')) { return 0 }
  try { return [int](& node -p "process.versions.node.split('.')[0]") } catch { return 0 }
}

function Get-Python314 {
  if (Test-Command 'py') {
    try { $p = (& py -3.14 -c "import sys; print(sys.executable)" 2>$null); if ($LASTEXITCODE -eq 0 -and $p) { return $p.Trim() } } catch {}
  }
  $candidate = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python314\python.exe'
  if (Test-Path $candidate) { return $candidate }
  return $null
}

function Invoke-Checked([string]$Exe, [string[]]$Arguments, [string]$Failure) {
  if ($DryRun) { Write-Info "(simulación) $Exe $($Arguments -join ' ')"; return }
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Failure (código $LASTEXITCODE)." }
}

function Ensure-Prerequisites {
  Write-Step 'Comprobando Git, Node.js, Python y Ollama'
  Refresh-ProcessPath
  if (Test-Command 'git') { Write-Ok 'Git instalado.' } else { Install-WithWinget 'Git.Git' 'Git' }
  if ((Get-NodeMajor) -ge 22) { Write-Ok "Node.js $(Get-NodeMajor) instalado." } else { Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js' }
  if (Get-Python314) { Write-Ok 'Python 3.14 instalado.' } else { Install-WithWinget 'Python.Python.3.14' 'Python 3.14' }
  if (Test-Command 'ollama') { Write-Ok 'Ollama instalado.' } else { Install-WithWinget 'Ollama.Ollama' 'Ollama' }
  if ($DryRun) { return }
  if (-not (Test-Command 'git')) { throw 'Git se instaló pero no aparece todavía. Cierra esta ventana y vuelve a ejecutar "Instalar Efesto".' }
  if ((Get-NodeMajor) -lt 22) { throw 'Node.js 22 o superior no está disponible. Cierra esta ventana y vuelve a ejecutar "Instalar Efesto".' }
  if (-not (Get-Python314)) { throw 'Python 3.14 no está disponible. Cierra esta ventana y vuelve a ejecutar "Instalar Efesto".' }
  if (-not (Test-Command 'ollama')) { throw 'Ollama no está disponible. Cierra esta ventana y vuelve a ejecutar "Instalar Efesto".' }
}

function Ensure-HermesAgent {
  Write-Step 'Instalando Hermes Agent (búsqueda web DuckDuckGo)'
  if (-not [string]::IsNullOrWhiteSpace($env:HEPHAESTUS_HERMES_EXECUTABLE)) {
    Write-Ok "Se usa el Hermes configurado en HEPHAESTUS_HERMES_EXECUTABLE; no se modifica."
    return
  }
  if (Test-Path $HermesExe) {
    $venvPython = Join-Path $HermesRoot 'venv\Scripts\python.exe'
    if (-not $DryRun) { & $venvPython -c "import ddgs" 2>$null }
    if ($DryRun -or $LASTEXITCODE -eq 0) { Write-Ok 'Hermes Agent ya instalado con búsqueda DuckDuckGo.'; return }
    Write-Info 'Hermes está instalado pero le falta la búsqueda DuckDuckGo; se añade.'
    Invoke-Checked $venvPython @('-m', 'pip', 'install', '--quiet', '-e', "$HermesRoot[ddgs]") 'No se pudo añadir la búsqueda a Hermes'
    return
  }
  if (Test-Path $HermesRoot) {
    if (-not (Test-Path (Join-Path $HermesRoot '.git'))) { throw "Existe $HermesRoot pero no es una instalación de Hermes reconocible. Renómbrala y vuelve a ejecutar." }
  } else {
    if (-not $DryRun) { New-Item -ItemType Directory -Force -Path (Split-Path -Parent $HermesRoot) | Out-Null }
    Invoke-Checked 'git' @('clone', '--quiet', $HermesRepo, $HermesRoot) 'No se pudo descargar Hermes Agent'
  }
  Invoke-Checked 'git' @('-C', $HermesRoot, 'checkout', '--quiet', $HermesRevision) 'No se pudo fijar la versión de Hermes Agent'
  $python = Get-Python314
  if ($DryRun -and -not $python) { $python = 'py' }
  Invoke-Checked $python @('-m', 'venv', (Join-Path $HermesRoot 'venv')) 'No se pudo crear el entorno de Python de Hermes'
  $venvPython = Join-Path $HermesRoot 'venv\Scripts\python.exe'
  Invoke-Checked $venvPython @('-m', 'pip', 'install', '--quiet', '--upgrade', 'pip') 'No se pudo actualizar pip'
  Invoke-Checked $venvPython @('-m', 'pip', 'install', '--quiet', '-e', "$HermesRoot[ddgs]") 'No se pudo instalar Hermes Agent'
  if (-not $DryRun -and -not (Test-Path $HermesExe)) { throw 'Hermes se instaló pero no se encuentra hermes.exe.' }
  if ($DryRun) { Write-Info '(simulación) Hermes Agent quedaría instalado.' } else { Write-Ok 'Hermes Agent instalado.' }
}

function Ensure-OllamaModel {
  Write-Step "Preparando el modelo local $Model (la primera vez descarga unos 2-3 GB)"
  if ($DryRun) { Write-Info "(simulación) ollama pull $Model"; return }
  $up = $false
  try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null; $up = $true } catch {}
  if (-not $up) {
    Write-Info 'Arrancando Ollama...'
    Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden
    for ($i = 0; $i -lt 30 -and -not $up; $i++) { Start-Sleep -Seconds 2; try { Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 | Out-Null; $up = $true } catch {} }
    if (-not $up) { throw 'Ollama no responde en 127.0.0.1:11434.' }
  }
  $tags = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 10
  if ($tags.models | Where-Object { $_.name -eq $Model }) { Write-Ok "Modelo $Model ya descargado."; return }
  Invoke-Checked 'ollama' @('pull', $Model) "No se pudo descargar el modelo $Model"
  Write-Ok "Modelo $Model descargado."
}

function New-EfestoShortcut([string]$Name, [string]$Target, [string]$Description) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  if ([string]::IsNullOrWhiteSpace($desktop)) { return }
  $path = Join-Path $desktop "$Name.lnk"
  if ($DryRun) { Write-Info "(simulación) acceso directo $path"; return }
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($path)
  $shortcut.TargetPath = $env:ComSpec
  $shortcut.Arguments = "/c `"`"$Target`"`""
  $shortcut.WorkingDirectory = $RepoRoot
  $shortcut.Description = $Description
  $shortcut.Save()
  Write-Ok "Acceso directo en el escritorio: $Name"
}

try {
  Write-Host 'Efesto — instalación en un clic' -ForegroundColor White
  if ($DryRun) { Write-Host '(modo simulación: no se instala ni se cambia nada)' -ForegroundColor Yellow }

  Ensure-Prerequisites
  Ensure-HermesAgent
  Ensure-OllamaModel

  Write-Step 'Instalando y verificando el núcleo de Efesto (dependencias, Kernel, extensión)'
  $coreArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $RepoRoot 'scripts\install-efesto.ps1'), '-SkipNodeInstall', '-SkipShortcut')
  $env:HEPHAESTUS_PORT = '4310'
  $env:HEPHAESTUS_DATA_DIR = Join-Path $env:LOCALAPPDATA 'Efesto\kernel-data'
  Invoke-Checked 'powershell.exe' $coreArgs 'La instalación del núcleo de Efesto necesita atención'

  Write-Step 'Compilando el panel de Efesto'
  Invoke-Checked 'pnpm' @('dashboard:build') 'No se pudo compilar el panel'

  Write-Step 'Escribiendo la configuración local'
  Invoke-Checked 'node' @('scripts/windows/efesto-windows-stack.mjs', 'write-config') 'No se pudo escribir la configuración'

  Write-Step 'Creando los accesos directos "Iniciar Efesto" y "Detener Efesto"'
  if (-not $SkipShortcuts) {
    New-EfestoShortcut 'Iniciar Efesto' (Join-Path $RepoRoot 'Iniciar Efesto.cmd') 'Arranca Efesto (Kernel, panel, Hermes y Ollama)'
    New-EfestoShortcut 'Detener Efesto' (Join-Path $RepoRoot 'Detener Efesto.cmd') 'Detiene Efesto'
  } else { Write-Info 'Omitido.' }

  Write-Step 'Arrancando Efesto'
  if (-not $NoStart) { Invoke-Checked 'node' @('scripts/windows/efesto-windows-stack.mjs', 'start') 'Efesto no pudo arrancar' } else { Write-Info 'Omitido.' }

  Write-Step 'Comprobación final'
  if (-not $NoStart) { Invoke-Checked 'node' @('scripts/windows/efesto-windows-stack.mjs', 'status') 'Alguna pieza de Efesto no está en marcha' } else { Write-Info 'Omitido.' }

  Write-Host ''
  if ($DryRun) { Write-Host 'Simulación terminada: no se ha instalado ni cambiado nada.' -ForegroundColor Yellow; exit 0 }
  Write-Host 'Efesto está instalado.' -ForegroundColor Green
  Write-Host 'A partir de ahora usa el icono "Iniciar Efesto" del escritorio.'
  exit 0
} catch {
  Write-Host ''
  Write-Host "Efesto necesita atención: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Puedes volver a ejecutar "Instalar Efesto" cuando quieras: lo ya instalado no se repite.'
  exit 1
}
