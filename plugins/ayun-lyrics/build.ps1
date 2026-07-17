$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
cargo build --release --target wasm32-unknown-unknown
New-Item -ItemType Directory -Force dist | Out-Null
Copy-Item target\wasm32-unknown-unknown\release\mono_plugin_ayun_lyrics.wasm dist\ayun-lyrics.wasm -Force
Pop-Location
