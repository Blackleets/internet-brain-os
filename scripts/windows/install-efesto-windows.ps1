# Efesto: instalación completa en un clic para Windows.
# Comprueba/instala Git, Node.js 22+, Python 3.11–3.14 y Ollama (winget), instala Hermes Agent con búsqueda
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
# The user's own Hermes is never modified beyond adding the ddgs extra. If it is not at the
# validated revision, Efesto installs its own pinned copy in %LOCALAPPDATA%\Efesto\hermes-agent.
$UserHermesRoot = Join-Path $env:LOCALAPPDATA 'hermes\hermes-agent'
$EfestoHermesRoot = Join-Path $env:LOCALAPPDATA 'Efesto\hermes-agent'
$HermesRoot = $UserHermesRoot
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

# Native commands (python, py, git, pip, winget, ollama, node...) write warnings and tracebacks to stderr.
# Under $ErrorActionPreference='Stop' (and with *>&1 | Tee-Object) Windows PowerShell 5.1 turns that stderr into a
# terminating error. Every native call goes through Invoke-Native: stderr is captured as text and success is
# judged only by the exit code.
function Invoke-Native([string]$Exe, [string[]]$Arguments = @(), [switch]$Quiet) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $lines = @()
  $code = 1
  try {
    # streamed line by line (long steps like ollama pull or the dashboard build show progress), and captured
    $lines = @(& $Exe @Arguments 2>&1 | ForEach-Object {
      $text = if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { "$_" }
      if (-not $Quiet) { Write-Host "          $text" }
      $text
    })
    $code = $LASTEXITCODE
    if ($null -eq $code) { $code = 0 }
  } catch {
    $lines += $_.Exception.Message
    $code = 1
  } finally {
    $ErrorActionPreference = $previous
  }
  return [pscustomobject]@{ Code = [int]$code; Output = (($lines -join "`n").Trim()) }
}

function Install-WithWinget([string]$Id, [string]$Name) {
  if ($DryRun) { Write-Info "(simulación) winget install --id $Id"; return }
  if (-not (Test-Command 'winget')) {
    throw "Falta $Name y este equipo no tiene winget (Instalador de aplicaciones de Microsoft). Instala 'App Installer' desde Microsoft Store y vuelve a ejecutar."
  }
  Write-Info "Instalando $Name con winget (puede tardar unos minutos)..."
  $r = Invoke-Native 'winget' @('install', '--id', $Id, '--exact', '--accept-package-agreements', '--accept-source-agreements', '--silent')
  if ($r.Code -ne 0) { throw "winget no pudo instalar $Name (código $($r.Code))." }
  Refresh-ProcessPath
}

function Get-NodeMajor {
  if (-not (Test-Command 'node')) { return 0 }
  $r = Invoke-Native 'node' @('-p', "process.versions.node.split('.')[0]") -Quiet
  if ($r.Code -ne 0) { return 0 }
  try { return [int]$r.Output } catch { return 0 }
}

# Hermes Agent ae3f9f9c declares requires-python = ">=3.11,<3.15" (pyproject.toml): any installed 3.11–3.14 works.
$PythonMinor = @(14, 13, 12, 11)
function Test-HermesPython([string]$Exe) {
  $r = Invoke-Native $Exe @('-c', "import sys; print('%d.%d' % sys.version_info[:2])") -Quiet
  if ($r.Code -ne 0 -or -not $r.Output) { return $false }
  try { $parts = $r.Output.Split('.'); return ([int]$parts[0] -eq 3 -and [int]$parts[1] -ge 11 -and [int]$parts[1] -le 14) } catch { return $false }
}
function Get-HermesPython {
  if (Test-Command 'py') {
    foreach ($m in $PythonMinor) {
      $r = Invoke-Native 'py' @("-3.$m", '-c', 'import sys; print(sys.executable)') -Quiet
      if ($r.Code -eq 0 -and $r.Output) { return $r.Output }
    }
  }
  foreach ($name in @('python', 'python3')) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -notlike '*WindowsApps*' -and (Test-HermesPython $cmd.Source)) { return $cmd.Source }
  }
  foreach ($m in $PythonMinor) {
    $candidate = Join-Path $env:LOCALAPPDATA "Programs\Python\Python3$m\python.exe"
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

function Invoke-Checked([string]$Exe, [string[]]$Arguments, [string]$Failure) {
  if ($DryRun) { Write-Info "(simulación) $Exe $($Arguments -join ' ')"; return }
  $r = Invoke-Native $Exe $Arguments
  if ($r.Code -ne 0) { throw "$Failure (código $($r.Code))." }
}

function Ensure-Prerequisites {
  Write-Step 'Comprobando Git, Node.js, Python y Ollama'
  Refresh-ProcessPath
  if (Test-Command 'git') { Write-Ok 'Git instalado.' } else { Install-WithWinget 'Git.Git' 'Git' }
  if ((Get-NodeMajor) -ge 22) { Write-Ok "Node.js $(Get-NodeMajor) instalado." } else { Install-WithWinget 'OpenJS.NodeJS.LTS' 'Node.js' }
  $foundPython = Get-HermesPython
  if ($foundPython) { Write-Ok "Python compatible encontrado: $foundPython" } else { Install-WithWinget 'Python.Python.3.13' 'Python 3.13' }
  if (Test-Command 'ollama') { Write-Ok 'Ollama instalado.' } else { Install-WithWinget 'Ollama.Ollama' 'Ollama' }
  if ($DryRun) { return }
  if (-not (Test-Command 'git')) { throw 'Git se instaló pero no aparece todavía. Cierra esta ventana y vuelve a ejecutar "Instalar Efesto".' }
  if ((Get-NodeMajor) -lt 22) { throw 'Node.js 22 o superior no está disponible. Cierra esta ventana y vuelve a ejecutar "Instalar Efesto".' }
  if (-not (Get-HermesPython)) { throw 'No hay Python 3.11–3.14 disponible. Cierra esta ventana y vuelve a ejecutar "Instalar Efesto".' }
  if (-not (Test-Command 'ollama')) { throw 'Ollama no está disponible. Cierra esta ventana y vuelve a ejecutar "Instalar Efesto".' }
}

function Get-HermesRevision([string]$Root) {
  if (-not (Test-Path (Join-Path $Root '.git'))) { return '' }
  $rev = Invoke-Native 'git' @('-C', $Root, 'rev-parse', '--short=11', 'HEAD') -Quiet
  if ($rev.Code -eq 0 -and $rev.Output) { return ([string]$rev.Output).Trim() }
  return ''
}

function Ensure-HermesDdgs([string]$Root) {
  $venvPython = Join-Path $Root 'venv\Scripts\python.exe'
  if ($DryRun) { Write-Info '(simulación) se comprobaría ddgs.'; return }
  $probe = Invoke-Native $venvPython @('-c', 'import ddgs') -Quiet
  if ($probe.Code -eq 0) { Write-Ok 'Hermes Agent con búsqueda DuckDuckGo.'; return }
  Write-Info 'A Hermes le falta la búsqueda DuckDuckGo; se añade (ddgs==9.16.0).'
  Invoke-Checked $venvPython @('-m', 'pip', 'install', '--quiet', 'ddgs==9.16.0') 'No se pudo añadir la búsqueda a Hermes'
  $probe = Invoke-Native $venvPython @('-c', 'import ddgs') -Quiet
  if ($probe.Code -ne 0) { throw 'Se instaló ddgs pero Hermes sigue sin poder importarlo.' }
  Write-Ok 'Búsqueda DuckDuckGo añadida a Hermes Agent.'
}

function Use-HermesRoot([string]$Root) {
  $script:HermesRoot = $Root
  $script:HermesExe = Join-Path $Root 'venv\Scripts\hermes.exe'
  # Inherited by install-efesto.ps1, the launcher repair, the Kernel and efesto-windows-stack.mjs.
  $env:HEPHAESTUS_HERMES_EXECUTABLE = $script:HermesExe
  $env:EFESTO_HERMES_ROOT = $Root
  Write-Info "Efesto usará Hermes en $script:HermesExe"
}

function Install-PinnedHermes([string]$Root) {
  if (Test-Path $Root) {
    if (-not (Test-Path (Join-Path $Root '.git'))) { throw "Existe $Root pero no es una instalación de Hermes reconocible. Renómbrala y vuelve a ejecutar." }
    Invoke-Checked 'git' @('-C', $Root, 'fetch', '--quiet', 'origin') 'No se pudo actualizar la copia de Hermes de Efesto'
  } else {
    if (-not $DryRun) { New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Root) | Out-Null }
    Invoke-Checked 'git' @('clone', '--quiet', $HermesRepo, $Root) 'No se pudo descargar Hermes Agent'
  }
  Invoke-Checked 'git' @('-C', $Root, 'checkout', '--quiet', $HermesRevision) 'No se pudo fijar la versión de Hermes Agent'
  $python = Get-HermesPython
  if ($DryRun -and -not $python) { $python = 'py' }
  $venv = Join-Path $Root 'venv'
  if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) {
    Invoke-Checked $python @('-m', 'venv', $venv) 'No se pudo crear el entorno de Python de Hermes'
  }
  $venvPython = Join-Path $venv 'Scripts\python.exe'
  Invoke-Checked $venvPython @('-m', 'pip', 'install', '--quiet', '--upgrade', 'pip') 'No se pudo actualizar pip'
  Invoke-Checked $venvPython @('-m', 'pip', 'install', '--quiet', '-e', "$Root[ddgs]") 'No se pudo instalar Hermes Agent'
  if (-not $DryRun -and -not (Test-Path (Join-Path $venv 'Scripts\hermes.exe'))) { throw 'Hermes se instaló pero no se encuentra hermes.exe.' }
  if ($DryRun) { Write-Info "(simulación) Hermes Agent $HermesRevision quedaría instalado en $Root." } else { Write-Ok "Hermes Agent $HermesRevision instalado en $Root." }
}

function Ensure-HermesAgent {
  Write-Step 'Instalando Hermes Agent (búsqueda web DuckDuckGo)'
  if (-not [string]::IsNullOrWhiteSpace($env:HEPHAESTUS_HERMES_EXECUTABLE)) {
    Write-Ok "Se usa el Hermes configurado en HEPHAESTUS_HERMES_EXECUTABLE; no se modifica."
    return
  }
  # 1. The user's Hermes is used only when it is exactly the validated revision.
  $userExe = Join-Path $UserHermesRoot 'venv\Scripts\hermes.exe'
  if (Test-Path $userExe) {
    $rev = Get-HermesRevision $UserHermesRoot
    if ($rev -and $rev.StartsWith($HermesRevision)) {
      Write-Info "Hermes Agent existente en la revisión validada $rev."
      Ensure-HermesDdgs $UserHermesRoot
      Use-HermesRoot $UserHermesRoot
      return
    }
    $shown = if ($rev) { $rev } else { 'desconocida' }
    Write-Info "Tu Hermes Agent está en la revisión $shown (Efesto se valida con $HermesRevision); no se toca. Efesto instala su propia copia fijada."
  }
  # 2. Otherwise Efesto's own pinned copy (reused when already at the pin).
  $ownExe = Join-Path $EfestoHermesRoot 'venv\Scripts\hermes.exe'
  $ownRev = Get-HermesRevision $EfestoHermesRoot
  if ((Test-Path $ownExe) -and $ownRev -and $ownRev.StartsWith($HermesRevision)) {
    Write-Info "Copia de Hermes de Efesto ya en $ownRev."
    Ensure-HermesDdgs $EfestoHermesRoot
  } else {
    Install-PinnedHermes $EfestoHermesRoot
  }
  Use-HermesRoot $EfestoHermesRoot
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
