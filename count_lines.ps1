$files = @(
    "d:\work\rust\mono\src-tauri\src\lib.rs",
    "d:\work\rust\mono\src-tauri\src\main.rs",
    "d:\work\rust\mono\src-tauri\build.rs",
    "d:\work\rust\mono\src\App.vue",
    "d:\work\rust\mono\src\components\PlayerDock.vue",
    "d:\work\rust\mono\src\components\WindowControls.vue",
    "d:\work\rust\mono\src\components\SettingsView.vue",
    "d:\work\rust\mono\src\components\LyricsView.vue",
    "d:\work\rust\mono\src\components\PrimarySidebar.vue",
    "d:\work\rust\mono\src\components\WorkspaceView.vue",
    "d:\work\rust\mono\src\components\FolderCover.vue",
    "d:\work\rust\mono\src\components\LibraryPanel.vue",
    "d:\work\rust\mono\src\components\ThemeView.vue",
    "d:\work\rust\mono\src\components\TrayMenu.vue",
    "d:\work\rust\mono\src\components\ArtistsView.vue",
    "d:\work\rust\mono\src\types\music.ts",
    "d:\work\rust\mono\src\stores\player.ts",
    "d:\work\rust\mono\src\i18n.ts",
    "d:\work\rust\mono\src\services\music.ts",
    "d:\work\rust\mono\src\main.ts",
    "d:\work\rust\mono\src\data\demoLibrary.ts",
    "d:\work\rust\mono\src\utils\format.ts",
    "d:\work\rust\mono\src\vite-env.d.ts",
    "d:\work\rust\mono\vite.config.ts",
    "d:\work\rust\mono\src\styles.css"
)

foreach ($f in $files) {
    if (Test-Path $f) {
        $lines = (Get-Content $f | Measure-Object -Line).Lines
        $result = "{0,-55} {1,5}" -f (Split-Path $f -Leaf), $lines
        Write-Host $result
    } else {
        Write-Host "NOT FOUND: $f"
    }
}
