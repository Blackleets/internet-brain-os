param(
  [switch]$SkipNodeInstall,
  [switch]$SkipShortcut,
  [switch]$EnableAutoStart
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Write-Step([string]$Message) {
  Write-Host "[Efesto] $Message" -ForegroundColor Cyan
}

function Refresh-ProcessPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = @($machine, $user) -join ';'
}

function Test-Command([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-NodeMajor {
  if (-not (Test-Command 'node')) { return 0 }
  try { return [int](& node -p "process.versions.node.split('.')[0]") } catch { return 0 }
}

function Ensure-Node {
  $major = Get-NodeMajor
  if ($major -ge 22) { Write-Step "Node.js detected (major $major)."; return }
  if ($SkipNodeInstall) { throw 'Node.js 22 or newer is required and automatic installation was disabled.' }
  if (-not (Test-Command 'winget')) { throw 'Node.js 22 or newer is required. Windows Package Manager (winget) was not found, so Efesto cannot install Node automatically on this machine.' }
  Write-Step 'Installing the current Node.js LTS with Windows Package Manager...'
  & winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements --silent
  if ($LASTEXITCODE -ne 0) { throw "winget could not install Node.js (exit $LASTEXITCODE)." }
  Refresh-ProcessPath
  if ((Get-NodeMajor) -lt 22) { throw 'Node.js installation completed but Node 22+ is still not available in this process.' }
}

function Ensure-Pnpm {
  if (Test-Command 'pnpm') {
    $version = (& pnpm --version).Trim()
    if ($version -eq '11.11.0') { Write-Step 'pnpm 11.11.0 detected.'; return }
  }
  if (-not (Test-Command 'npm')) { throw 'npm is unavailable even though Node.js is installed.' }
  Write-Step 'Installing the repository-pinned pnpm 11.11.0...'
  & npm install --global pnpm@11.11.0
  if ($LASTEXITCODE -ne 0) { throw "npm could not install pnpm 11.11.0 (exit $LASTEXITCODE)." }
  Refresh-ProcessPath
  if (-not (Test-Command 'pnpm')) { throw 'pnpm installation finished but pnpm is not available on PATH.' }
}

function Invoke-Pnpm([string[]]$Arguments, [string]$FailureMessage) {
  Push-Location -LiteralPath $RepoRoot
  try {
    & pnpm @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$FailureMessage (exit $LASTEXITCODE)." }
  } finally {
    Pop-Location
  }
}

function Resolve-HermesExecutable {
  if (-not [string]::IsNullOrWhiteSpace($env:HEPHAESTUS_HERMES_EXECUTABLE)) {
    return $env:HEPHAESTUS_HERMES_EXECUTABLE.Trim()
  }
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { return $null }
  $standard = Join-Path $env:LOCALAPPDATA 'hermes\hermes-agent\venv\Scripts\hermes.exe'
  if (Test-Path $standard) { return $standard }
  return $null
}

function Test-HermesSafeSearchRuntime([string]$Executable) {
  if ([string]::IsNullOrWhiteSpace($Executable) -or -not (Test-Path $Executable)) { return $false }
  try {
    $help = (& $Executable chat --help 2>&1 | Out-String)
    if ($LASTEXITCODE -ne 0) { return $false }
    $hasQuery = $help -match '(?m)(^|\s)(-q(,|\s)|--query)'
    $hasQuiet = $help -match '(?m)(^|\s)(-Q(,|\s)|--quiet)'
    return $hasQuery -and $hasQuiet -and $help.Contains('--max-turns') -and $help.Contains('--toolsets') -and $help.Contains('--ignore-rules')
  } catch {
    return $false
  }
}

function Ensure-HermesSafeSearchRuntime {
  $hermes = Resolve-HermesExecutable
  if ([string]::IsNullOrWhiteSpace($hermes)) {
    Write-Step 'Hermes was not found. The launcher will stop with setup guidance instead of claiming Efesto is ready.'
    return
  }

  if (Test-HermesSafeSearchRuntime $hermes) {
    Write-Step 'Hermes bounded search-only runtime certified.'
    return
  }

  if (-not [string]::IsNullOrWhiteSpace($env:HEPHAESTUS_HERMES_EXECUTABLE)) {
    throw 'The configured custom Hermes runtime does not expose Efesto safe-search controls. Efesto will not modify a custom runtime automatically.'
  }

  Write-Step 'Hermes is installed but incompatible with Efesto safe search. Updating Hermes with backup...'
  & $hermes update --backup --yes
  if ($LASTEXITCODE -ne 0) { throw "Hermes update failed (exit $LASTEXITCODE)." }

  $hermes = Resolve-HermesExecutable
  if (-not (Test-HermesSafeSearchRuntime $hermes)) {
    throw 'Hermes updated, but the bounded search-only controls are still unavailable. Efesto remains blocked safely.'
  }
  Write-Step 'Hermes updated and bounded search-only runtime certified.'
}

function Install-DesktopShortcut {
  if ($SkipShortcut) { return }
  $desktop = [Environment]::GetFolderPath('Desktop')
  if ([string]::IsNullOrWhiteSpace($desktop)) { return }
  $shortcutPath = Join-Path $desktop 'Efesto.lnk'
  $launcherPath = Join-Path $RepoRoot 'Efesto Launcher.cmd'
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $env:ComSpec
  $shortcut.Arguments = "/c `"`"$launcherPath`"`""
  $shortcut.WorkingDirectory = $RepoRoot
  $shortcut.Description = 'Efesto — The Intelligence Forge'
  $shortcut.Save()
  Write-Step "Desktop shortcut ready: $shortcutPath"
}

try {
  Write-Step 'Checking local prerequisites...'
  Ensure-Node
  Ensure-Pnpm

  Write-Step 'Installing verified workspace dependencies from the lockfile...'
  Invoke-Pnpm @('install', '--frozen-lockfile') 'Dependency installation failed'

  Write-Step 'Building the trusted Kernel runtime and its internal project references...'
  Invoke-Pnpm @('exec', 'tsc', '-b', 'packages/kernel/tsconfig.json') 'Kernel runtime build failed'

  Write-Step 'Building the trusted public-web connectors runtime...'
  Invoke-Pnpm @('exec', 'tsc', '-b', 'packages/connectors/tsconfig.json') 'Connectors runtime build failed'

  $sharedRuntime = Join-Path $RepoRoot 'packages\shared\dist\index.js'
  $kernelRuntime = Join-Path $RepoRoot 'packages\kernel\dist\index.js'
  $connectorsRuntime = Join-Path $RepoRoot 'packages\connectors\dist\index.js'
  if (-not (Test-Path $sharedRuntime)) { throw 'Kernel dependency build completed but packages\shared\dist\index.js is missing.' }
  if (-not (Test-Path $kernelRuntime)) { throw 'Kernel runtime build completed but packages\kernel\dist\index.js is missing.' }
  if (-not (Test-Path $connectorsRuntime)) { throw 'Connectors runtime build completed but packages\connectors\dist\index.js is missing.' }

  Write-Step 'Verifying that the trusted Kernel runtime can be imported...'
  Invoke-Pnpm @('exec', 'node', 'scripts/trusted-kernel-runtime-doctor.mjs') 'Trusted Kernel runtime verification failed'

  Write-Step 'Building the browser extension bundle...'
  Invoke-Pnpm @('build:extension') 'Extension build failed'

  Write-Step 'Verifying the Hermes safe-search runtime...'
  Ensure-HermesSafeSearchRuntime

  Write-Step 'Running Efesto launcher repair/start...'
  Invoke-Pnpm @('efesto:launcher', 'repair') 'Efesto launcher repair failed'

  Install-DesktopShortcut
  if ($EnableAutoStart) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'efesto-autostart.ps1') -Action Enable
    if ($LASTEXITCODE -ne 0) { throw 'Automatic startup could not be enabled.' }
  }

  Write-Host ''
  Write-Host 'Efesto is installed and ready.' -ForegroundColor Green
  Write-Host 'Open the extension, pair it if requested, and press the central Efesto orb.'
  exit 0
} catch {
  Write-Host ''
  Write-Host "Efesto installation needs attention: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}