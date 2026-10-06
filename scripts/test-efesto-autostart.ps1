$ErrorActionPreference = 'Stop'
$TestFolder = Join-Path ([IO.Path]::GetTempPath()) ('efesto-startup-' + [guid]::NewGuid().ToString())
$Script = Join-Path $PSScriptRoot 'efesto-autostart.ps1'
New-Item -ItemType Directory -Path $TestFolder | Out-Null
try {
  foreach ($Action in @('Enable', 'Enable', 'Status')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Script -Action $Action -StartupDirectory $TestFolder
    if ($LASTEXITCODE -ne 0) { throw "Startup $Action failed" }
  }
  $Path = Join-Path $TestFolder 'Efesto Kernel.lnk'
  $Shell = New-Object -ComObject WScript.Shell
  $Shortcut = $Shell.CreateShortcut($Path)
  if ($Shortcut.Arguments -notlike '*-Action Run' -or $Shortcut.Arguments -notlike '*-WindowStyle Hidden*') { throw 'Wrong startup target' }
  Set-Content -LiteralPath (Join-Path $TestFolder 'unrelated.txt') -Value 'keep'
  foreach ($Action in @('Disable', 'Disable')) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Script -Action $Action -StartupDirectory $TestFolder
    if ($LASTEXITCODE -ne 0) { throw 'Disable failed' }
  }
  if (Test-Path -LiteralPath $Path) { throw 'Owned shortcut remains' }
  if ((Get-Content -LiteralPath (Join-Path $TestFolder 'unrelated.txt')) -ne 'keep') { throw 'Unrelated file changed' }
  $Foreign = $Shell.CreateShortcut($Path)
  $Foreign.TargetPath = $env:ComSpec
  $Foreign.Description = 'Other owner'
  $Foreign.Save()
  $Before = (Get-FileHash -LiteralPath $Path).Hash
  foreach ($Action in @('Enable', 'Disable')) {
    $Rejected = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $Script + '"'), '-Action', $Action, '-StartupDirectory', ('"' + $TestFolder + '"')) -Wait -PassThru -WindowStyle Hidden -RedirectStandardError (Join-Path $TestFolder 'expected-rejection.txt')
    if ($Rejected.ExitCode -eq 0) { throw 'Foreign shortcut accepted' }
    if ((Get-FileHash -LiteralPath $Path).Hash -ne $Before) { throw 'Foreign shortcut changed' }
  }
  Write-Output 'PASS: real Windows shortcut registration, idempotency, removal and foreign-owner preservation'
} finally { Remove-Item -LiteralPath $TestFolder -Recurse -Force }
