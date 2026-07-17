# Rust Audio Backend Steps

## Assumptions

- Keep the existing Vue and Pinia queue logic in place.
- Use Rust as the only audio output backend for local files and plain HTTP/HTTPS online audio URLs.
- Do not keep `HTMLAudioElement` playback fallback. Unsupported sources must be resolved into a Rust-playable local path or direct HTTP/HTTPS URL before playback starts.
- Use Rodio's `Sink::try_seek`, `Sink::get_pos`, and `Sink::is_paused` for Rust backend seek, progress, and state synchronization.

## Implemented MVP

1. Add `rodio` to `src-tauri/Cargo.toml`.
2. Add `src-tauri/src/player.rs` for the Rust audio backend.
3. Register `PlayerState` in `src-tauri/src/lib.rs`.
4. Expose Tauri commands:
   - `player_play_path`
   - `player_play_url`
   - `player_pause`
   - `player_stop`
   - `player_seek`
   - `player_set_volume`
   - `player_set_speed`
   - `player_system_temp_cache_dir`
   - `player_set_cache_dir`
   - `player_set_queue`
   - `player_output_devices`
   - `player_set_output_device`
   - `player_state`
5. Emit `player://state` from Rust about every 250 ms while the active sink is alive.
6. Emit `player://ended` from Rust when the active sink finishes naturally.
7. Emit `player://advanced` from Rust when playback advances into a pre-queued seamless track.
8. Add `src/services/playerBackend.ts` to wrap the Tauri commands and event listeners.
9. Keep the frontend queue, next-track, previous-track, favorites, lyrics, and playback mode selection in Vue/Pinia, but send all actual audio output to Rust.

## Completed Synchronization Work

1. Precise seek now calls Rust `player_seek(seconds)`, which uses Rodio `Sink::try_seek`.
2. Backend progress now comes from Rust `player://state` events using Rodio `Sink::get_pos`.
3. Playback state sync now comes from Rust `player://state` events using Rodio `Sink::is_paused` and `Sink::empty`.
4. `PlayerDock.vue` treats Rust state as authoritative for playback, progress, and play/pause UI.
5. `PlayerDock.vue` no longer renders or controls an `HTMLAudioElement`.
6. Playback speed now calls Rust `player_set_speed(rate)`, which applies Rodio `Sink::set_speed`.

## Completed Playback Error Work

1. `PlayerDock.vue` now shows visible playback errors instead of failing silently.
2. Rust command failures from play, pause, and seek are converted into a short Dock-level error prompt.
3. Unsupported active sources show a clear message that Rust playback needs a local file path or direct HTTP/HTTPS URL.
4. Error prompts auto-dismiss after a short delay and can also be closed manually.
5. The error UI is local to the player Dock, so it does not introduce a global notification dependency.

## Completed Output Device Work

1. Rust now exposes `player_output_devices` to enumerate system output devices through Rodio/CPAL.
2. Rust now exposes `player_set_output_device(deviceId)` to select the output device.
3. Playback settings now include an output device selector with:
   - System default
   - Detected headphones, speakers, virtual audio devices, and other CPAL output devices
   - Refresh
4. The selected output device is persisted in `PlayerSettings.audioOutputDeviceId`.
5. `PlayerDock.vue` watches the setting and syncs it to Rust.
6. Leaving the setting empty uses the system default output device.
7. If a track is already active when the device changes, Rust rebuilds the current sink on the new device, seeks back to the previous position, and preserves play/pause state.
8. New playback sinks also use the selected device.
9. While Rust playback is active, the state watcher checks whether the selected output device is still available.
10. If the selected device disappears, for example when Bluetooth headphones disconnect, Rust clears the selected device, rebuilds the active sink on the system default output device, seeks back to the previous position, and preserves play/pause state.
11. Rust emits `player://output-device-fallback` after a successful automatic fallback.
12. `PlayerDock.vue` listens for the fallback event, resets `audioOutputDeviceId` to System default, and shows a short playback notice.
13. Device IDs currently use the system device name, which is simple and readable but may change if the OS renames a device.

## Completed Online Playback Work

1. Rust now exposes `player_play_url(url, restart)` for HTTP/HTTPS audio URLs.
2. The online Rust backend opens the HTTP response with `reqwest::blocking::get`.
3. A background thread continuously reads the response into a temporary cache file under the app cache directory.
4. Rodio decodes from a custom `Read + Seek` file-backed stream reader, so playback can start while download continues.
5. When the server provides `Content-Length`, the reader passes that length to Rodio for better duration and seek behavior.
6. Online playback uses the same Rust `player://state`, `player://ended`, `player_seek`, pause, stop, and volume flow as local playback.
7. `PlayerDock.vue` now routes HTTP/HTTPS active track URLs to `player_play_url` first.
8. If Rust URL playback fails, `PlayerDock.vue` stops playback state instead of falling back to browser audio.

## Completed Rust Online Resolution Work

1. Rust now exposes `resolve_plugin_playback_plan`.
2. The Rust command validates that the selected provider plugin is installed, enabled, and supports playback.
3. Rust now owns the playback quality fallback decision:
   - Preferred quality is tried first.
   - `lower` tries lower qualities after the preferred quality.
   - `higher` tries higher qualities after the preferred quality.
   - `none` tries only the preferred quality.
4. `App.vue` no longer builds the quality fallback list itself.
5. `App.vue` asks Rust for a playback plan, then uses the existing WASM plugin runtime only to execute each Rust-ordered playback attempt.
6. The final resolved HTTP/HTTPS URL is still handed to the Rust audio queue startup command for actual playback.
7. Full WASM execution still uses the existing frontend WebAssembly runtime; the online playback decision and fallback policy now live in Rust.

## Completed Cover Thumbnail Cache Work

1. Rust now exposes `read_cover_thumbnail` for song-list cover thumbnails.
2. `read_cover_thumbnail` stores 96x96 JPEG thumbnails under the app cache directory in `cover-thumbnails`.
3. The thumbnail cache key includes the audio file path, file size, and modified time, so changed files automatically get a new cached thumbnail.
4. The first thumbnail read still parses the embedded/local cover, but later reads use the cached thumbnail file directly.
5. `TrackCoverThumb.vue` now uses `read_cover_thumbnail` instead of loading full-size embedded artwork.
6. The existing in-memory cover URL cache and request de-duplication remain in place for fast repeat rendering during the current app session.
7. Larger cover views such as the player dock and lyrics view still use `read_cover` so they can display higher-resolution artwork.

## Completed Cache Cleanup Work

1. Online playback cache files are written to `app_cache_dir/online-audio-cache`.
2. Cache file names use the `mono-stream-*.audio` pattern.
3. Startup cleanup removes old cache files, which handles abnormal exits from a previous run.
4. A background cleanup thread waits until local midnight and then removes stale cache files every day.
5. Daily cleanup skips the cache file currently used by the active Rust playback session.
6. Playback settings now include a temporary cache directory field.
7. Leaving the field empty uses the app default cache directory.
8. The settings page can fill the field with the system temp cache directory: `temp/mono-player/online-audio-cache`.
9. Users can also choose a custom temporary cache directory.
10. When the setting changes, `PlayerDock.vue` calls Rust `player_set_cache_dir`, and future online streams use that directory.
11. Playback settings now include a maximum cache size in MB, persisted as `audioCacheMaxMb`.
12. `PlayerDock.vue` calls Rust `player_prune_cache(maxBytes)` when the cache directory or maximum size setting changes.
13. The settings page includes an "Apply limit" action for immediate pruning.
14. The settings page includes a "Clear cache" action backed by Rust `player_clear_cache`.
15. Manual and size-limit cleanup skip current and pre-queued playback cache files.

## Completed Seamless Playback Work

1. `PlayerDock.vue` syncs the Rust-playable queue, current source, playback mode, seamless setting, and crossfade setting to Rust.
2. Rust owns the automatic next-track decision for repeat, fixed, and shuffle modes.
3. Rust owns the random selection used by shuffle mode.
4. Rust tracks the active source duration when Rodio can report it.
5. When seamless playback is enabled and the active source has about 8 seconds remaining, Rust chooses the next queue item and preloads it.
6. For normal seamless playback, Rust appends the chosen source to the current Rodio `Sink`.
7. For crossfade playback, Rust starts the chosen source in a new sink and fades from the old sink to the new sink.
8. When Rust detects that the sink advanced into the queued source, it promotes that queued source to `current_source`.
9. Rust emits `player://advanced` with the new source.
10. `PlayerDock.vue` only listens for `player://advanced`, emits `seamlessAdvance(track)`, and lets `App.vue` update current track state without issuing a new automatic play request.
11. If Rust cannot determine the active source duration, it skips early preload and still advances from the Rust queue when the current sink ends.

## Completed Rust Queue Control Work

1. Rust now exposes `player_next` and `player_previous` so manual next/previous playback uses the same queue engine as automatic advancement.
2. Rust now exposes `player_play_queue_source(source)` so clicking a queue item asks Rust to switch to that queue source directly.
3. Rust now exposes `player_queue_snapshot` and emits `player://queue` with:
   - Queue source order
   - Current source
   - Current queue index
   - Playback mode
4. `PlayerDock.vue` keeps a Rust queue snapshot and renders the queue popover from Rust-provided track metadata.
5. Rust now exposes queue edit commands:
   - `player_queue_insert_next(source)`
   - `player_queue_append(source)`
   - `player_queue_remove(source)`
   - `player_queue_move(fromIndex, toIndex)`
6. The track context menu now mirrors "play next" and "append to queue" edits into Rust through the queue edit commands.
7. Keyboard, tray, and dock next/previous actions call Rust queue commands instead of choosing the next track in Vue/Pinia.
8. Rust queue snapshots now include full track metadata, not only source paths.
9. `PlayerDock.vue` renders the queue directly from `snapshot.tracks` and no longer maps Rust sources through the frontend Pinia queue.
10. `App.vue` passes a Rust playback queue ref to the Dock instead of `player.queue`.
11. Track context menu queue edits call Rust edit commands directly and no longer update the Pinia queue mirror.

## Completed Rust Queue Startup Work

1. Rust now exposes `player_start_queue`.
2. `player_start_queue` receives the candidate track list, an optional requested source, playback mode, seamless/crossfade settings, and optional start position.
3. If a requested source is provided, Rust starts that source from the queue.
4. If no requested source is provided, Rust chooses the initial source:
   - Shuffle mode uses Rust-side random selection.
   - Repeat and fixed modes start from the first playable queue item.
5. `App.vue` no longer chooses the random starting track for "play all".
6. Local track playback, online track playback, queue item playback, and play-all startup now call Rust queue startup instead of setting a frontend current track and asking the Dock to start playback.
7. Rust starts playback immediately and returns a queue snapshot; the frontend only syncs UI from the returned snapshot.

## Seamless Playback Limits

- Seamless playback applies only to sources the Rust backend can play directly: local files and plain HTTP/HTTPS URLs.
- Single-track mode does not pre-queue a next track.
- Shuffle mode preselects a random Rust-playable queue item shortly before the current track ends.
- Online plugin results that still have unresolved `plugin://` placeholder paths cannot be pre-queued until they have a direct playable URL.
- If seamless playback is disabled, Rust still plays the active track, but the next queue item is started by the Rust `player://ended` event and the existing Vue queue selection flow.

## Completed Fade And Crossfade Work

1. Playback settings now include two persisted switches:
   - `fadePlayback`
   - `crossfadePlayback`
2. The playback settings page exposes these as:
   - Fade in/out
   - Crossfade between tracks
3. Rust playback commands accept fade settings for normal playback, pause, and stop.
4. Fade in starts a Rust-backed track at volume 0 and ramps to the configured playback volume.
5. Fade out ramps the active Rust sink to 0 before pausing or stopping.
6. Crossfade creates a second Rodio `Sink` for the next track.
7. During crossfade, the old sink ramps down while the new sink ramps up.
8. Rust emits `player://advanced` when the crossfade target becomes the active source, and the frontend updates current-track state without restarting audio.

## Fade And Crossfade Limits

- Fade and crossfade apply to Rust-backed playback.
- Crossfade currently uses a fixed 3 second transition.
- Fade in/out currently uses short fixed ramps for start, pause, and stop.

## Online Playback Limits

- The current Rust URL backend streams into temporary files, so memory pressure is low for long tracks.
- URLs that require custom headers, cookies, signed request details, or special anti-hotlink behavior must be resolved or supported in the Rust backend before playback.
- HTTP Range based seek is not implemented yet.

## Verification

- `npm run build` passes.
- `cargo check` passes from `src-tauri/`.
- `src-tauri/Cargo.lock` includes the Rodio dependency tree.

## Runtime Flow

1. The user selects a track in Vue.
2. `App.vue` updates the Pinia queue and increments `playRequestId`.
3. `PlayerDock.vue` receives the current track.
4. For local file paths, `PlayerDock.vue` calls `player_play_path`.
5. For HTTP/HTTPS audio URLs, `PlayerDock.vue` calls `player_play_url`.
6. During Rust playback, Rust emits `player://state` with current source, position, playing state, and volume.
7. Near the end of a Rust-backed track, `PlayerDock.vue` may pre-queue the next Rust-playable queue item.
8. If crossfade is enabled, `PlayerDock.vue` starts the next Rust-playable track in a second sink and Rust fades between the two sinks.
9. If crossfade is disabled, Rust may still pre-queue the next source for seamless playback.
10. If the pre-queued or crossfaded source starts, Rust emits `player://advanced` and the frontend updates current-track state without restarting audio.
11. `PlayerDock.vue` updates `currentTime`, play/pause UI, and persisted playback time from Rust state.
12. When Rust playback ends without a pre-queued next source, `player://ended` triggers the existing next-track flow and the next selected queue item starts through Rust.

## Completed Rust Queue Playback Work

1. Playback queue ownership remains in Pinia so shuffle, repeat, fixed mode, online metadata, and UI selection keep their existing behavior.
2. Actual queue audio output is now Rust-only.
3. Previous/next/manual queue selection updates the active track in Vue, then `PlayerDock.vue` starts the selected source with `player_play_path` or `player_play_url`.
4. `PlayerDock.vue` now syncs the Rust-playable queue, active source, and playback mode into Rust with `player_set_queue`.
5. Rust stores the queue sources, current queue index, and playback mode.
6. Natural track end is now handled by Rust first: the backend selects the next source for repeat, shuffle, or fixed mode and starts a new Rodio sink.
7. After Rust starts the next queue source, it emits `player://advanced`; Vue updates the visible active track without issuing a new play command.
8. If Rust has no playable next source, it still emits `player://ended`, and the existing frontend next-track fallback can run.
9. Manual previous/next/manual queue selection still updates the active track in Vue, then starts the selected source through Rust.
10. Seamless playback and crossfade still use Rust pre-queue/crossfade commands and `player://advanced`.
11. `HTMLAudioElement` playback fallback has been removed from `PlayerDock.vue`.

## Rust Queue Engine Limits

 - Rust queue entries are currently source strings, not full track metadata.
 - Vue/Pinia still owns library metadata, online plugin metadata, favorites, lyrics, and visible queue UI.
 - Online plugin tracks must still resolve `plugin://` placeholders into direct Rust-playable HTTP/HTTPS URLs before they can enter the Rust queue.
 - Rust shuffle uses a lightweight timestamp-based selection instead of a seeded history-aware shuffle bag.

## Next Steps

1. Add tests around command registration and Rust-only frontend playback behavior.
2. Add optional request headers for plugin playback URLs that need `Referer`, `User-Agent`, or cookies.
3. Add HTTP Range based seek for remote sources that support it.
4. Add user settings for preload timing.
5. Add user settings for fade and crossfade duration.
6. Add optional pitch-preserving time stretching if plain Rodio speed changes are not enough.
7. Add a Rust `player://error` event for decoder/runtime errors that happen after a command has already succeeded.
8. Move more queue metadata into Rust if the backend should eventually own the whole playback session.
