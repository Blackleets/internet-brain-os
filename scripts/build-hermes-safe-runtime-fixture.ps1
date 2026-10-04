param(
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$directory = Split-Path -Parent $OutputPath
if (-not [string]::IsNullOrWhiteSpace($directory)) {
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

$candidates = @(
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
  (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$csc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $csc) { throw 'Windows C# compiler is unavailable; cannot build the CI-only Hermes runtime fixture.' }

$source = @'
using System;

public static class Program
{
    public static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--version")
        {
            Console.WriteLine("Hermes Agent CI safe-runtime fixture");
            return 0;
        }

        if (args.Length >= 2 && args[0] == "chat" && args[1] == "--help")
        {
            Console.WriteLine("-q, --query PROMPT");
            Console.WriteLine("-Q, --quiet");
            Console.WriteLine("--max-turns N");
            Console.WriteLine("--toolsets TOOLSETS");
            Console.WriteLine("--ignore-rules");
            return 0;
        }

        Console.Error.WriteLine("CI fixture: unsupported Hermes invocation");
        return 2;
    }
}
'@

$tempSource = Join-Path ([System.IO.Path]::GetTempPath()) ("efesto-hermes-fixture-" + [guid]::NewGuid().ToString('N') + '.cs')
try {
  Set-Content -Path $tempSource -Value $source -Encoding ascii
  & $csc /nologo /target:exe /optimize+ "/out:$OutputPath" $tempSource
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $OutputPath)) {
    throw "Unable to build the CI-only Hermes runtime fixture (csc exit $LASTEXITCODE)."
  }
} finally {
  Remove-Item -Force $tempSource -ErrorAction SilentlyContinue
}

Write-Host "CI-only Hermes safe-runtime fixture ready: $OutputPath"
