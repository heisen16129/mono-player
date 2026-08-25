$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$esbuild = Join-Path $repoRoot 'node_modules\.bin\esbuild.cmd'
$source = Join-Path $PSScriptRoot 'src\renderer.mjs'
$output = Join-Path $PSScriptRoot 'renderer.mjs'
$vendorDir = Join-Path $PSScriptRoot 'src\vendor\mineradio'
$vendorEngine = Join-Path $vendorDir 'engine.js'
$skullSource = Join-Path $vendorDir 'skull-decimation-points.bin'
$skullQuantized = Join-Path $vendorDir 'skull-decimation-points.q16'
$quantizer = Join-Path $PSScriptRoot 'scripts\quantize-skull.mjs'

if (-not (Test-Path -LiteralPath $esbuild)) {
  throw 'esbuild is unavailable. Run npm install from the repository root first.'
}

$parts = @(
  (Join-Path $vendorDir '_preamble.js.part'),
  (Join-Path $vendorDir '_adapted_sections.js.part'),
  (Join-Path $vendorDir '_postamble.js.part')
)
$engineSource = ($parts | ForEach-Object { [System.IO.File]::ReadAllText($_, [System.Text.Encoding]::UTF8) }) -join "`n"
[System.IO.File]::WriteAllText($vendorEngine, $engineSource, [System.Text.UTF8Encoding]::new($false))

& node $quantizer $skullSource $skullQuantized
if ($LASTEXITCODE -ne 0) {
  throw "Mineradio skull asset quantization failed with exit code $LASTEXITCODE."
}

& $esbuild $source --bundle --format=esm --target=es2020 --minify --legal-comments=inline --loader:.css=text --loader:.q16=dataurl --outfile=$output
if ($LASTEXITCODE -ne 0) {
  throw "Mineradio renderer build failed with exit code $LASTEXITCODE."
}
