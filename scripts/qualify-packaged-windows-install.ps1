param(
  [Parameter(Mandatory = $true)][string]$CandidateDir,
  [Parameter(Mandatory = $true)][string]$ReleaseVersion,
  [Parameter(Mandatory = $true)][string]$ExpectedCommit
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$zipName = "efesto-v$ReleaseVersion-windows.zip"
$zipPath = Join-Path $CandidateDir $zipName
$checksumPath = Join-Path $CandidateDir 'SHA256SUMS.txt'
$buildInfoPath = Join-Path $CandidateDir 'BUILD_INFO.txt'
$diagnosticPath = Join-Path $CandidateDir 'qualification-diagnostic.txt'

if (-not (Test-Path $zipPath)) { throw "Missing packaged candidate: $zipName" }
if (-not (Test-Path $checksumPath)) { throw 'Missing SHA256SUMS.txt.' }
if (-not (Test-Path $buildInfoPath)) { throw 'Missing BUILD_INFO.txt.' }

$expectedDigest = ((Get-Content $checksumPath -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
$actualDigest = (Get-FileHash -Algorithm SHA256 -Path $zipPath).Hash.ToLowerInvariant()
if ($actualDigest -ne $expectedDigest) { throw 'Candidate checksum mismatch.' }

$buildInfo = @{}
foreach ($line in Get-Content $buildInfoPath) {
  if ($line -match '^([^=]+)=(.*)$') { $buildInfo[$matches[1]] = $matches[2] }
}
if ($buildInfo['version'] -ne $ReleaseVersion) { throw 'BUILD_INFO version mismatch.' }
if ($buildInfo['commit'] -ne $ExpectedCommit) { throw 'BUILD_INFO commit mismatch.' }

$extractRoot = Join-Path $env:RUNNER_TEMP 'Efesto Candidate With Spaces'
$dataDir = Join-Path $env:RUNNER_TEMP 'Efesto Data With Spaces'
Remove-Item -Recurse -Force $extractRoot -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $dataDir -ErrorAction SilentlyContinue
Remove-Item -Force $diagnosticPath -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $extractRoot, $dataDir | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

$release = Get-Content (Join-Path $extractRoot 'INTERNAL_RELEASE.json') -Raw | ConvertFrom-Json
if ($release.version -ne $ReleaseVersion) { throw 'Extracted release metadata version mismatch.' }
if ($release.publicLaunchApproved -ne $false) { throw 'Internal candidate must remain blocked from public promotion.' }
if ($release.entrypoint -ne 'Install Efesto.cmd') { throw 'Unexpected Windows entrypoint.' }

$testToken = 'f' * 64
$testBoundaryKey = 'internal-package-qualification-key'
$tokenPath = Join-Path $dataDir 'kernel-api-token'
Set-Content -Path $tokenPath -Value $testToken -NoNewline
$tokenDigestBefore = (Get-FileHash -Algorithm SHA256 -Path $tokenPath).Hash

$env:HEPHAESTUS_DATA_DIR = $dataDir
$env:HEPHAESTUS_HERMES_EXECUTABLE = (Get-Command node).Source
$env:HEPHAESTUS_HERMES_SECRET = $testBoundaryKey
$env:HEPHAESTUS_PAIRING = '0'
Remove-Item Env:HEPHAESTUS_OBSIDIAN_DIR -ErrorAction SilentlyContinue
Remove-Item Env:HEPHAESTUS_INTERNAL_PORT -ErrorAction SilentlyContinue
Remove-Item Env:HEPHAESTUS_PORT -ErrorAction SilentlyContinue
Remove-Item Env:IBOS_HERMES_SECRET -ErrorAction SilentlyContinue

function Sanitize([string]$Text) {
  if ($null -eq $Text) { return '' }
  return $Text.Replace($testToken, '<redacted-kernel-token>').Replace($testBoundaryKey, '<redacted-boundary-key>')
}

function Get-SanitizedLogTail([string]$LogPath) {
  if (-not (Test-Path $LogPath)) { return '<installer log missing>' }
  $text = Sanitize (Get-Content $LogPath -Raw)
  $lines = $text -split "`r?`n"
  return (($lines | Select-Object -Last 60) -join [Environment]::NewLine)
}

function Write-SanitizedDiagnostic([string]$FailureMessage) {
  $firstLog = Join-Path $env:RUNNER_TEMP 'efesto-packaged-first-install.log'
  $repairLog = Join-Path $env:RUNNER_TEMP 'efesto-packaged-repair.log'
  $diagnostic = @(
    "release=$ReleaseVersion",
    "commit=$ExpectedCommit",
    "runner=$env:RUNNER_NAME",
    "os=$env:RUNNER_OS",
    "failure=$(Sanitize $FailureMessage)",
    '--- first install tail ---',
    (Get-SanitizedLogTail $firstLog),
    '--- repair tail ---',
    (Get-SanitizedLogTail $repairLog)
  ) -join [Environment]::NewLine
  Set-Content -Path $diagnosticPath -Value $diagnostic -Encoding utf8
}

function Invoke-QualifiedInstall([string]$LogName, [switch]$SkipShortcut) {
  $logPath = Join-Path $env:RUNNER_TEMP $LogName
  $stdoutPath = "$logPath.stdout"
  $stderrPath = "$logPath.stderr"
  Remove-Item -Force $logPath, $stdoutPath, $stderrPath -ErrorAction SilentlyContinue

  $scriptPath = Join-Path $extractRoot 'scripts\install-efesto.ps1'
  $argumentLine = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -SkipNodeInstall"
  if ($SkipShortcut) { $argumentLine += ' -SkipShortcut' }

  $process = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList $argumentLine `
    -WorkingDirectory $extractRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -Wait `
    -PassThru `
    -NoNewWindow

  $stdout = if (Test-Path $stdoutPath) { Get-Content $stdoutPath -Raw } else { '' }
  $stderr = if (Test-Path $stderrPath) { Get-Content $stderrPath -Raw } else { '' }
  $logText = @($stdout, $stderr) -join [Environment]::NewLine
  Set-Content -Path $logPath -Value $logText -Encoding utf8

  if ($logText.Contains($testToken) -or $logText.Contains($testBoundaryKey)) {
    throw 'Installer exposed a private runtime credential in its output.'
  }
  if ($process.ExitCode -ne 0) {
    $sanitizedTail = Get-SanitizedLogTail $logPath
    Write-Host '--- sanitized installer tail ---'
    Write-Host $sanitizedTail
    Write-Host '--- end sanitized installer tail ---'
    throw "Packaged installer failed with exit $($process.ExitCode)."
  }
}

try {
  Invoke-QualifiedInstall 'efesto-packaged-first-install.log'

  if (-not (Test-Path (Join-Path $extractRoot 'packages\shared\dist\index.js'))) { throw 'Shared runtime was not built.' }
  if (-not (Test-Path (Join-Path $extractRoot 'packages\kernel\dist\index.js'))) { throw 'Kernel runtime was not built.' }
  if (-not (Test-Path (Join-Path $extractRoot 'apps\extension\dist\manifest.json'))) { throw 'Browser extension was not built.' }

  Push-Location $extractRoot
  try {
    $bootstrap = node scripts/efesto-bootstrap.mjs | ConvertFrom-Json
  } finally {
    Pop-Location
  }
  if ($bootstrap.kernel -ne 'ready' -or -not $bootstrap.diagnostics.kernel.alive -or -not $bootstrap.diagnostics.kernel.owned -or -not $bootstrap.diagnostics.kernel.verified) {
    throw 'Packaged install did not produce an owned, verified Kernel.'
  }
  if ($bootstrap.hermes -ne 'ready') { throw 'Packaged install Hermes boundary is not ready.' }

  $status = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/status' -TimeoutSec 5
  if (-not $status.ok -or $status.kernel -ne 'ready') { throw 'Kernel did not remain ready after packaged installation.' }

  $desktop = [Environment]::GetFolderPath('Desktop')
  if (-not [string]::IsNullOrWhiteSpace($desktop)) {
    $shortcutPath = Join-Path $desktop 'Efesto.lnk'
    if (-not (Test-Path $shortcutPath)) { throw 'Efesto desktop shortcut was not created.' }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    if ($shortcut.WorkingDirectory -ne $extractRoot) { throw 'Efesto shortcut targets the wrong working directory.' }
    if ($shortcut.Arguments -notlike '*Efesto Launcher.cmd*') { throw 'Efesto shortcut does not route through the trusted launcher.' }
  }

  Invoke-QualifiedInstall 'efesto-packaged-repair.log' -SkipShortcut
  $tokenDigestAfter = (Get-FileHash -Algorithm SHA256 -Path $tokenPath).Hash
  if ($tokenDigestAfter -ne $tokenDigestBefore) { throw 'Repair unexpectedly replaced the existing private Kernel token.' }

  Push-Location $extractRoot
  try {
    $afterRepair = node scripts/efesto-bootstrap.mjs | ConvertFrom-Json
  } finally {
    Pop-Location
  }
  if ($afterRepair.kernel -ne 'ready' -or -not $afterRepair.diagnostics.kernel.owned -or -not $afterRepair.diagnostics.kernel.verified) {
    throw 'Packaged repair did not preserve an owned, verified Kernel.'
  }
} catch {
  Write-SanitizedDiagnostic $_.Exception.Message
  throw
} finally {
  Push-Location $extractRoot
  try {
    pnpm efesto:launcher shutdown 2>$null | Out-Null
  } catch {
    # Cleanup must not hide the qualification result.
  } finally {
    Pop-Location
  }
}
