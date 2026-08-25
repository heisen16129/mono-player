$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$esbuild = Join-Path $repoRoot 'node_modules\.bin\esbuild.cmd'
$generator = Join-Path $PSScriptRoot 'scripts\generate-upstream.mjs'
$source = Join-Path $PSScriptRoot 'src\renderer.mjs'
$output = Join-Path $PSScriptRoot 'renderer.mjs'

if (-not (Test-Path -LiteralPath $esbuild)) {
  throw 'esbuild is unavailable. Run npm install from the repository root first.'
}

& node $generator
if ($LASTEXITCODE -ne 0) {
  throw "Mineradio upstream generation failed with exit code $LASTEXITCODE."
}

& $esbuild $source --bundle --format=esm --target=es2020 --minify --legal-comments=inline --loader:.css=text --loader:.part=text --loader:.bin=dataurl --outfile=$output
if ($LASTEXITCODE -ne 0) {
  throw "Mineradio original renderer build failed with exit code $LASTEXITCODE."
}

$size = (Get-Item -LiteralPath $output).Length
Write-Host "Mineradio original renderer built: $size bytes"
