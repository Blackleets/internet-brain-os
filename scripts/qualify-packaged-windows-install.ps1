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

$testBoundaryKey = 'internal-package-qualification-key'
$script:testToken = ''
$script:phase = 'setup'
$script:freshBootstrapDiagnostic = '<not-yet-observed>'
$tokenPath = Join-Path $dataDir 'kernel-api-token'
$registryPath = Join-Path $dataDir 'authorized-extensions.json'

$env:HEPHAESTUS_DATA_DIR = $dataDir
$env:HEPHAESTUS_HERMES_EXECUTABLE = (Get-Command node).Source
$env:HEPHAESTUS_HERMES_SECRET = $testBoundaryKey
Remove-Item Env:HEPHAESTUS_PAIRING -ErrorAction SilentlyContinue
Remove-Item Env:HEPHAESTUS_OBSIDIAN_DIR -ErrorAction SilentlyContinue
Remove-Item Env:HEPHAESTUS_INTERNAL_PORT -ErrorAction SilentlyContinue
Remove-Item Env:HEPHAESTUS_PORT -ErrorAction SilentlyContinue
Remove-Item Env:IBOS_HERMES_SECRET -ErrorAction SilentlyContinue

function Sanitize([string]$Text) {
  if ($null -eq $Text) { return '' }
  $sanitized = $Text.Replace($testBoundaryKey, '<redacted-boundary-key>')
  if (-not [string]::IsNullOrEmpty($script:testToken)) {
    $sanitized = $sanitized.Replace($script:testToken, '<redacted-kernel-token>')
  }
  return $sanitized
}

function Get-SanitizedLogTail([string]$LogPath) {
  if (-not (Test-Path $LogPath)) { return '<installer log unavailable>' }
  $text = Sanitize (Get-Content $LogPath -Raw)
  $lines = $text -split "`r?`n"
  return (($lines | Select-Object -Last 60) -join [Environment]::NewLine)
}

function Write-SanitizedDiagnostic([string]$FailureMessage) {
  $repairLog = Join-Path $env:RUNNER_TEMP 'efesto-packaged-repair.log'
  $diagnostic = @(
    "release=$ReleaseVersion",
    "commit=$ExpectedCommit",
    "runner=$env:RUNNER_NAME",
    "os=$env:RUNNER_OS",
    "phase=$script:phase",
    "failure=$(Sanitize $FailureMessage)",
    '--- fresh bootstrap ---',
    (Sanitize $script:freshBootstrapDiagnostic),
    '--- captured repair tail ---',
    (Get-SanitizedLogTail $repairLog)
  ) -join [Environment]::NewLine
  Set-Content -Path $diagnosticPath -Value $diagnostic -Encoding utf8
}

function Invoke-CommandFile([string]$CommandPath, [int]$TimeoutMs = 240000) {
  $startInfo = New-Object System.Diagnostics.ProcessStartInfo
  $startInfo.FileName = $env:ComSpec
  $startInfo.Arguments = "/d /s /c `"`"$CommandPath`"`""
  $startInfo.WorkingDirectory = $extractRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true

  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $startInfo
  if (-not $process.Start()) { throw 'Unable to start packaged installer command.' }
  if (-not $process.WaitForExit($TimeoutMs)) {
    try { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue } catch { }
    $process.Dispose()
    throw "Packaged installer command timed out after $TimeoutMs ms."
  }
  $exitCode = [int]$process.ExitCode
  $process.Dispose()
  return $exitCode
}

function Write-InstallCommand(
  [string]$CommandPath,
  [string]$StdoutTarget,
  [string]$StderrTarget,
  [switch]$SkipShortcut
) {
  $scriptPath = Join-Path $extractRoot 'scripts\install-efesto.ps1'
  $skipArgument = if ($SkipShortcut) { ' -SkipShortcut' } else { '' }
  $command = @(
    '@echo off',
    "cd /d `"$extractRoot`"",
    "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -SkipNodeInstall$skipArgument 1>$StdoutTarget 2>$StderrTarget",
    'exit /b %ERRORLEVEL%'
  ) -join "`r`n"
  Set-Content -Path $CommandPath -Value $command -Encoding ascii
}

function Invoke-FreshInstall {
  $script:phase = 'fresh-unpaired-install'
  $commandPath = Join-Path $env:RUNNER_TEMP 'efesto-packaged-fresh-install.cmd'
  Remove-Item -Force $commandPath -ErrorAction SilentlyContinue
  Write-InstallCommand -CommandPath $commandPath -StdoutTarget 'NUL' -StderrTarget 'NUL'
  try {
    $exitCode = Invoke-CommandFile $commandPath
  } finally {
    Remove-Item -Force $commandPath -ErrorAction SilentlyContinue
  }
  if ($exitCode -ne 0) { throw "Fresh packaged installer failed with exit $exitCode." }
}

function Invoke-CapturedRepair {
  $script:phase = 'paired-repair'
  $logPath = Join-Path $env:RUNNER_TEMP 'efesto-packaged-repair.log'
  $stdoutPath = "$logPath.stdout"
  $stderrPath = "$logPath.stderr"
  $commandPath = "$logPath.cmd"
  Remove-Item -Force $logPath, $stdoutPath, $stderrPath, $commandPath -ErrorAction SilentlyContinue

  Write-InstallCommand `
    -CommandPath $commandPath `
    -StdoutTarget "`"$stdoutPath`"" `
    -StderrTarget "`"$stderrPath`"" `
    -SkipShortcut

  try {
    $exitCode = Invoke-CommandFile $commandPath
  } finally {
    Remove-Item -Force $commandPath -ErrorAction SilentlyContinue
  }

  $stdout = if (Test-Path $stdoutPath) { Get-Content $stdoutPath -Raw } else { '' }
  $stderr = if (Test-Path $stderrPath) { Get-Content $stderrPath -Raw } else { '' }
  $logText = @($stdout, $stderr) -join [Environment]::NewLine
  Set-Content -Path $logPath -Value $logText -Encoding utf8
  Remove-Item -Force $stdoutPath, $stderrPath -ErrorAction SilentlyContinue

  if (-not [string]::IsNullOrEmpty($script:testToken) -and $logText.Contains($script:testToken)) {
    throw 'Installer exposed the private Kernel token in captured repair output.'
  }
  if ($logText.Contains($testBoundaryKey)) {
    throw 'Installer exposed the Hermes boundary credential in captured repair output.'
  }
  if ($exitCode -ne 0) {
    Write-Host '--- sanitized repair tail ---'
    Write-Host (Get-SanitizedLogTail $logPath)
    Write-Host '--- end sanitized repair tail ---'
    throw "Packaged repair failed with exit $exitCode."
  }
  if (-not $logText.Contains('Efesto is installed and ready.')) {
    throw 'Captured repair did not reach the installer success boundary.'
  }
}

function Get-Bootstrap {
  Push-Location $extractRoot
  try {
    return node scripts/efesto-bootstrap.mjs | ConvertFrom-Json
  } finally {
    Pop-Location
  }
}

function Stop-OwnedKernel {
  $commandPath = Join-Path $env:RUNNER_TEMP 'efesto-packaged-shutdown.cmd'
  Remove-Item -Force $commandPath -ErrorAction SilentlyContinue
  $command = @(
    '@echo off',
    "cd /d `"$extractRoot`"",
    'node scripts\efesto-launcher.mjs shutdown >NUL 2>NUL',
    'exit /b %ERRORLEVEL%'
  ) -join "`r`n"
  Set-Content -Path $commandPath -Value $command -Encoding ascii
  try {
    $shutdownExit = Invoke-CommandFile -CommandPath $commandPath -TimeoutMs 30000
  } finally {
    Remove-Item -Force $commandPath -ErrorAction SilentlyContinue
  }
  if ($shutdownExit -ne 0) { throw "Unable to stop the owned Efesto Kernel (exit $shutdownExit)." }
}

try {
  Invoke-FreshInstall

  if (-not (Test-Path (Join-Path $extractRoot 'packages\shared\dist\index.js'))) { throw 'Shared runtime was not built.' }
  if (-not (Test-Path (Join-Path $extractRoot 'packages\kernel\dist\index.js'))) { throw 'Kernel runtime was not built.' }
  if (-not (Test-Path (Join-Path $extractRoot 'apps\extension\dist\manifest.json'))) { throw 'Browser extension was not built.' }
  if (-not (Test-Path $tokenPath)) { throw 'Fresh packaged install did not create the private Kernel token.' }

  $script:testToken = (Get-Content $tokenPath -Raw).Trim()
  if ([string]::IsNullOrWhiteSpace($script:testToken)) { throw 'Fresh packaged install created an empty Kernel token.' }
  $tokenDigestBefore = (Get-FileHash -Algorithm SHA256 -Path $tokenPath).Hash

  $freshBootstrap = Get-Bootstrap
  $script:freshBootstrapDiagnostic = $freshBootstrap | ConvertTo-Json -Compress -Depth 6
  if ($freshBootstrap.kernel -ne 'ready' -or -not $freshBootstrap.diagnostics.kernel.alive -or -not $freshBootstrap.diagnostics.kernel.owned -or -not $freshBootstrap.diagnostics.kernel.verified) {
    throw 'Fresh packaged install did not produce an owned, verified Kernel.'
  }
  if ($freshBootstrap.hermes -ne 'ready') { throw 'Fresh packaged install Hermes boundary is not ready.' }
  if ($freshBootstrap.obsidian -ne 'not_configured') { throw "Fresh packaged install expected Obsidian not_configured, got $($freshBootstrap.obsidian)." }
  if ($freshBootstrap.pairing -ne 'required') { throw "Fresh packaged install expected pairing required, got $($freshBootstrap.pairing)." }

  $status = Invoke-RestMethod -Uri 'http://127.0.0.1:4000/status' -TimeoutSec 5
  if (-not $status.ok -or $status.kernel -ne 'ready') { throw 'Kernel did not remain ready after fresh packaged installation.' }

  $desktop = [Environment]::GetFolderPath('Desktop')
  if (-not [string]::IsNullOrWhiteSpace($desktop)) {
    $shortcutPath = Join-Path $desktop 'Efesto.lnk'
    if (-not (Test-Path $shortcutPath)) { throw 'Fresh packaged install did not create the Efesto desktop shortcut.' }
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    if ($shortcut.WorkingDirectory -ne $extractRoot) { throw 'Efesto shortcut targets the wrong working directory.' }
    if ($shortcut.Arguments -notlike '*Efesto Launcher.cmd*') { throw 'Efesto shortcut does not route through the trusted launcher.' }
  }

  Stop-OwnedKernel

  $script:phase = 'prepare-synthetic-paired-repair'
  $syntheticExtensionId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  $registry = @{ version = 1; extensionIds = @($syntheticExtensionId) } | ConvertTo-Json -Depth 3
  [System.IO.File]::WriteAllText($registryPath, $registry, (New-Object System.Text.UTF8Encoding($false)))

  $pairedBeforeRepair = Get-Bootstrap
  if ($pairedBeforeRepair.pairing -ne 'paired') { throw 'Synthetic internal extension identity did not produce a paired bootstrap state.' }

  Invoke-CapturedRepair

  $tokenDigestAfter = (Get-FileHash -Algorithm SHA256 -Path $tokenPath).Hash
  if ($tokenDigestAfter -ne $tokenDigestBefore) { throw 'Repair unexpectedly replaced the existing private Kernel token.' }

  $afterRepair = Get-Bootstrap
  if ($afterRepair.kernel -ne 'ready' -or -not $afterRepair.diagnostics.kernel.alive -or -not $afterRepair.diagnostics.kernel.owned -or -not $afterRepair.diagnostics.kernel.verified) {
    throw 'Packaged repair did not preserve an owned, verified Kernel.'
  }
  if ($afterRepair.hermes -ne 'ready') { throw 'Packaged repair Hermes boundary is not ready.' }
  if ($afterRepair.pairing -ne 'paired') { throw 'Packaged repair did not preserve the paired extension state.' }

  $script:phase = 'qualified'
} catch {
  Write-SanitizedDiagnostic $_.Exception.Message
  throw
} finally {
  if (Test-Path $extractRoot) {
    try { Stop-OwnedKernel } catch { }
  }
}
