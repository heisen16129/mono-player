$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$viteProcess = $null
$exitCode = 0

try {
  $viteProcess = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev') -WorkingDirectory $repoRoot.Path -PassThru -WindowStyle Hidden
  & npm.cmd run tauri -- dev --config src-tauri/tauri.dev.conf.json
  $exitCode = $LASTEXITCODE
} finally {
  if ($viteProcess -and -not $viteProcess.HasExited) {
    & taskkill.exe /PID $viteProcess.Id /T /F | Out-Null
  }
}

exit $exitCode
