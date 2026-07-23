$ErrorActionPreference = "Stop"
$dist = Join-Path $PSScriptRoot "dist"
New-Item -ItemType Directory -Force -Path $dist | Out-Null
cargo build --manifest-path "$PSScriptRoot/Cargo.toml" --target wasm32-unknown-unknown --release --offline
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Copy-Item "$PSScriptRoot/target/wasm32-unknown-unknown/release/mono_plugin_theme_dark.wasm" (Join-Path $dist "theme-dark.wasm") -Force
