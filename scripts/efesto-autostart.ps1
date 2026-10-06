param(
  [ValidateSet('Enable', 'Disable', 'Status', 'Run')][string]$Action = 'Status',
  [string]$StartupDirectory
)
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Owner = 'Efesto per-user autostart v1'
$ScriptPath = Join-Path $PSScriptRoot 'efesto-autostart.ps1'
$PowerShellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $ScriptPath + '" -Action Run'

if ($Action -eq 'Run') {
  Set-Location -LiteralPath $RepoRoot
  # Never install packages, update models or invoke the interactive repair at login.
  & node (Join-Path $PSScriptRoot 'efesto-launcher.mjs') autostart
  exit $LASTEXITCODE
}
if ([string]::IsNullOrWhiteSpace($StartupDirectory)) { $StartupDirectory = [Environment]::GetFolderPath('Startup') }
if ([string]::IsNullOrWhiteSpace($StartupDirectory)) { throw 'Windows Startup folder is unavailable.' }
$ShortcutPath = Join-Path $StartupDirectory 'Efesto Kernel.lnk'
$Shell = New-Object -ComObject WScript.Shell
$Exists = Test-Path -LiteralPath $ShortcutPath
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
if ($Exists -and ($Shortcut.Description -ne $Owner -or $Shortcut.Arguments -ne $Arguments -or $Shortcut.TargetPath -ne $PowerShellPath)) {
  throw 'A different startup entry exists. Efesto will not overwrite or remove it.'
}
if ($Action -eq 'Status') { Write-Output $(if ($Exists) { 'Efesto automatic start: enabled' } else { 'Efesto automatic start: disabled' }); exit 0 }
if ($Action -eq 'Disable') {
  if ($Exists) { Remove-Item -LiteralPath $ShortcutPath }
  Write-Output 'Efesto automatic start disabled. Your Kernel and data were not removed.'
  exit 0
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Efesto first: Node.js is unavailable.' }
foreach ($Runtime in @('packages\kernel\dist\index.js', 'packages\shared\dist\index.js', 'packages\connectors\dist\index.js')) {
  if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $Runtime))) { throw 'Install Efesto first: runtime files are missing.' }
}
New-Item -ItemType Directory -Force -Path $StartupDirectory | Out-Null
$Shortcut.TargetPath = $PowerShellPath
$Shortcut.Arguments = $Arguments
$Shortcut.WorkingDirectory = $RepoRoot
$Shortcut.WindowStyle = 7
$Shortcut.Description = $Owner
$Shortcut.Save()
Write-Output 'Efesto will start when you sign into Windows. Use Disable Efesto Auto Start.cmd to undo.'
