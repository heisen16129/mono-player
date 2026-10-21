$ErrorActionPreference = "Stop"
$pluginName = Split-Path -Leaf $PSScriptRoot
$buildScript = Join-Path $PSScriptRoot "../../scripts/build-plugin-wasm.mjs"
node $buildScript $pluginName
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
