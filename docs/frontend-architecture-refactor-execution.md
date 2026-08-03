# Frontend Architecture Refactor Execution Plan

## Goal

Refactor the frontend architecture step by step without changing user-facing behavior. Keep each step small, verifiable, and documented before moving to the next step.

## Current Working Context

- The app is a Vue 3 + Pinia + Tauri frontend.
- `AppLayout.vue` has been introduced but is not committed yet.
- `App.vue` is still the largest orchestration point and should not be expanded further.
- `AppMainContent.vue` now delegates layout to `AppLayout.vue`, but it still acts as a page selector and event pass-through layer.

## Execution Rules

- Execute one step at a time.
- After each step, run the listed verification.
- After verification, update this document with the result before starting the next step.
- Keep changes surgical. Do not mix unrelated cleanup into a step.

## Steps

### Step 1: Stabilize `AppLayout`

Status: done

Goal: Make the newly introduced layout component valid, typed, and safe to keep as the base layout container.

Scope:
- Fix the resize handle accessibility label in `src/components/AppLayout.vue`.
- Run Vue type checking.
- Do not change layout behavior beyond fixing the broken template text.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Fixed the malformed resize handle `aria-label` in `src/components/AppLayout.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 2: Move Discover Page State Out Of `App.vue`

Status: done

Goal: Let the discover/online music page own search query, search history, provider selection, loading state, results, and pagination.

Scope:
- Introduce a page shell such as `DiscoverMusicPage.vue`.
- Move `useOnlineSearch` and `useSearchHistory` from `App.vue` into that page shell.
- Keep global playback, download, and favorite actions in the parent for now.

Verify:
- `npx vue-tsc --noEmit`
- Search flow still opens results, supports load more, and can play/download a result.

Result:
- Added `src/components/DiscoverMusicPage.vue` as the discover page shell.
- Moved online search state, search history, provider selection, loading state, results, and pagination into the discover page shell.
- Kept playback/download/favorite actions at the parent boundary through events and a read-only online search snapshot.
- `npx vue-tsc --noEmit` passed.

### Step 3: Move Download Page Flow Out Of `App.vue`

Status: done

Goal: Let the downloads page own download list state and item operations where possible.

Scope:
- Introduce `DownloadsPage.vue` or `useDownloadController`.
- Move download item persistence and item operations out of `App.vue`.
- Keep playback-related actions at the playback controller boundary.

Verify:
- `npx vue-tsc --noEmit`
- Download list can pause, retry, resume, delete, clear records, and play downloaded tracks.

Result:
- Added `src/composables/useDownloadController.ts` to own download item commands, queue event handling, persistence updates, and download service calls.
- Updated `App.vue` to consume download state/actions from the controller instead of directly managing download item operations.
- Kept playback-facing downloaded-track actions in `App.vue`, where queue and playlist boundaries still live.
- `npx vue-tsc --noEmit` passed.

### Step 4: Extract Playback Runtime Controller

Status: done

Goal: Stop `PlayerDock.vue` from directly owning Rust backend runtime concerns.

Scope:
- Extract Rust playback listeners, backend state sync, volume/speed/output-device side effects into a composable/controller.
- Keep `PlayerDock.vue` focused on UI and user intent events.

Verify:
- `npx vue-tsc --noEmit`
- Playback, pause, resume, seek, next/previous, queue, speed, volume, and output device still work.

Result:
- Added `src/composables/usePlayerDockRuntime.ts` for Rust playback runtime state, backend listeners, volume/speed/output-device/cache side effects, and playback start/stop/pause/resume control.
- Updated `PlayerDock.vue` to keep UI composition, queue popover, sleep timer, cover, and progress wiring while delegating backend runtime behavior to the new composable.
- `npx vue-tsc --noEmit` passed.

### Step 5: Split Plugin Manager Use Cases

Status: done

Goal: Reduce `PluginManagerView.vue` by moving plugin catalog, installed plugins, subscriptions, selection, and drag sorting into focused modules.

Scope:
- Extract plugin catalog flow.
- Extract installed plugin flow.
- Extract subscription flow.
- Extract selection and drag sorting.

Verify:
- `npx vue-tsc --noEmit`
- Plugin install/update/uninstall/enable/disable/import/subscription flows still work.

Result:
- Added `src/composables/usePluginSelection.ts` to own installed-plugin selection state, derived batch selections, select-all, and pruning.
- Added `src/composables/usePluginDragSort.ts` to own installed-plugin drag sorting, pointer listeners, order persistence, and cleanup.
- Updated `PluginManagerView.vue` to consume these use-case composables while leaving catalog, install/update/uninstall, subscription, and theme flows unchanged.
- `npx vue-tsc --noEmit` passed.

### Step 6: Extract Plugin Market State

Status: done

Goal: Move plugin marketplace filtering, selected detail, screenshots, labels, and install/update busy state out of `PluginManagerView.vue`.

Scope:
- Introduce `usePluginMarket` for market-only state and derived data.
- Keep install/update service commands in the page for now, exposed to the market composable as callbacks.
- Do not change the marketplace template or plugin install behavior.

Verify:
- `npx vue-tsc --noEmit`
- Market filters, detail selection, screenshots, and install/update buttons still bind to the same state.

Result:
- Added `src/composables/usePluginMarket.ts` for marketplace categories, status filters, search, selected plugin detail, screenshots, localized labels, and install/update busy state.
- Updated `PluginManagerView.vue` to consume marketplace state from `usePluginMarket` while keeping install/update service commands in the page.
- `npx vue-tsc --noEmit` passed.

### Step 7: Extract Plugin Subscription Flow

Status: done

Goal: Move subscription URL state, add/remove/sync busy state, and subscription service calls out of `PluginManagerView.vue`.

Scope:
- Introduce `usePluginSubscriptions` or equivalent.
- Keep catalog merge and deleted-plugin refresh as explicit callbacks so the dependency boundary stays visible.
- Do not change subscription UI markup.

Verify:
- `npx vue-tsc --noEmit`
- Subscription add/remove/sync and local import affordances remain wired.

Result:
- Added `src/composables/usePluginSubscriptions.ts` for subscription URL state, add/remove/sync flows, busy state, subscription loading, and subscription service calls.
- Updated `PluginManagerView.vue` to consume subscription state/actions from the composable while keeping catalog merge, deleted-plugin refresh, and selection pruning as explicit dependencies.
- `npx vue-tsc --noEmit` passed.

### Step 8: Thin `AppMainContent` Page Dispatch

Status: done

Goal: Reduce `AppMainContent.vue` from a broad page selector into a thinner layout/page dispatch layer.

Scope:
- Extract low-risk page branch helpers or page shell components where the prop/event surface is already clear.
- Keep navigation state in `useLibraryNavigation` and avoid introducing Vue Router in this step.
- Do not change visible navigation behavior.

Verify:
- `npx vue-tsc --noEmit`
- Library, discover, downloads, plugins, artists, settings, and theme views still render from the menu.

Result:
- Added `src/components/LibraryHomePage.vue` to own the local library panel/detail composition.
- Updated `AppMainContent.vue` to dispatch to `LibraryHomePage` for the main local library branch instead of assembling `LibraryContentLayout`, `LibraryPanel`, and `WorkspaceView` inline.
- `npx vue-tsc --noEmit` passed.

### Step 9: Extract Plugin Install Actions

Status: done

Goal: Move plugin install/update/uninstall/enable/disable/batch/local-import and plugin theme side effects out of `PluginManagerView.vue`.

Scope:
- Introduce `usePluginInstallActions` for plugin install actions and theme registration/removal side effects.
- Keep plugin table and bulk action UI unchanged.
- Keep installed/catalog refs explicit inputs to avoid hiding shared state ownership.

Verify:
- `npx vue-tsc --noEmit`
- Plugin install/update/uninstall/enable/disable/import and batch actions remain wired to the same template events.

Result:
- Added `src/composables/usePluginInstallActions.ts` for install/update/uninstall/enable/disable/batch/local-import actions and plugin theme side effects.
- Updated `PluginManagerView.vue` to consume plugin install actions from the composable while keeping installed/catalog refs explicit.
- `npx vue-tsc --noEmit` passed.

### Step 10: Extract App Bootstrap

Status: done

Goal: Move application startup initialization out of `App.vue`.

Scope:
- Introduce `useAppBootstrap` for persisted state hydration, audio cache setup, library panel/download loading, library loading, playback session restore, and startup listener registration.
- Keep listener implementations and playback restore implementation in `App.vue` for now.
- Do not change startup behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useAppBootstrap.ts` for application startup orchestration.
- Updated `App.vue` to call `useAppBootstrap` instead of owning the full `initializeApp` lifecycle block inline.
- `npx vue-tsc --noEmit` passed.

### Step 11: Extract App Event Listeners

Status: done

Goal: Move app-level Tauri/system/backend event listener registration and cleanup out of `App.vue`.

Scope:
- Introduce `useAppEventListeners` for download events, desktop lyrics events, Rust queue events, MCP sleep timer events, and system media events.
- Keep event handling behavior in `App.vue` callbacks for now.
- Do not change event payload handling or playback behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useAppEventListeners.ts` for event listener registration, duplicate-start guards, and cleanup.
- Updated `App.vue` to pass existing event handlers into the listener composable instead of owning listener registration/unlisten state directly.
- `npx vue-tsc --noEmit` passed.

### Step 12: Extract System Media Sync

Status: done

Goal: Move system media metadata sync out of `App.vue` while keeping system media action handling at the playback boundary.

Scope:
- Introduce `useSystemMediaSync` for the active-track/playback-time/is-playing watcher, sync throttling, artwork normalization, and system media service calls.
- Keep `handleSystemMediaAction` in `App.vue` because it controls playback, navigation, and window behavior.
- Do not change system media metadata payloads or action behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useSystemMediaSync.ts` for active-track playback metadata sync, throttling, artwork normalization, and system media service calls.
- Updated `App.vue` to call the composable and keep only system media action handling at the playback boundary.
- `npx vue-tsc --noEmit` passed.

### Step 13: Extract Desktop Lyrics Sync

Status: done

Goal: Move desktop lyrics window state broadcasting out of `App.vue` while keeping desktop lyrics action handling at the playback boundary.

Scope:
- Introduce `useDesktopLyricsSync` for desktop lyrics state watch, lyric color resolution, state broadcasting, and opening the desktop lyrics window.
- Keep `handleDesktopLyricsAction` in `App.vue` because it controls playback and view state.
- Do not change desktop lyrics payloads, color behavior, or action behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useDesktopLyricsSync.ts` for desktop lyrics state watching, lyric color resolution, state broadcasting, and opening the desktop lyrics window.
- Updated `App.vue` to consume the composable while keeping desktop lyrics action handling in the playback boundary.
- `npx vue-tsc --noEmit` passed.

### Step 14: Extract Queue Source Utilities

Status: done

Goal: Move queue source identity helpers out of `App.vue` so playback and queue cleanup code can share one pure utility boundary.

Scope:
- Introduce a queue source utility for source key normalization and equality.
- Update `App.vue` to import the helpers instead of defining them inline.
- Do not change queue identity behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/utils/queueSource.ts` for queue source key generation, normalization, and equality checks.
- Updated `App.vue` to import queue source helpers instead of defining them inline.
- `npx vue-tsc --noEmit` passed.

### Step 15: Extract Local Library Queue Pruning

Status: done

Goal: Move the watcher that removes deleted local library tracks from the Rust playback queue out of `App.vue`.

Scope:
- Introduce a composable for watching local library track identity changes and pruning removed local queue entries.
- Keep Rust queue snapshot handling and toast rendering as explicit callbacks from `App.vue`.
- Do not change queue pruning behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useLocalLibraryQueuePruning.ts` for watching local library changes and pruning removed local tracks from the Rust queue.
- Updated `App.vue` to pass queue state, Rust snapshot handling, and toast reporting into the composable.
- `npx vue-tsc --noEmit` passed.

### Step 16: Reuse Queue Source Utilities In Player Runtime

Status: done

Goal: Remove the duplicate queue source key implementation from `usePlayerDockRuntime.ts`.

Scope:
- Import the shared queue source helper in `usePlayerDockRuntime.ts`.
- Delete the local duplicate helper.
- Do not change backend path matching behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Updated `src/composables/usePlayerDockRuntime.ts` to import `queueSourceKey` from `src/utils/queueSource.ts`.
- Removed the local duplicate queue source helper from the player runtime composable.
- `npx vue-tsc --noEmit` passed.

### Step 17: Extract Playback Lyric Format State

Status: done

Goal: Move per-track playback lyric format selection state out of `App.vue`.

Scope:
- Introduce a composable for lyric format options, selected format lookup, selected variant, and setting the selected format per track.
- Keep lyric metadata loading and track lyric updates in `App.vue` for now.
- Do not change lyric format fallback behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/usePlaybackLyricFormat.ts` for per-track lyric format selection, format options, selected format fallback, and selected lyric variant.
- Updated `App.vue` to consume the composable while keeping lyric metadata loading in place.
- `npx vue-tsc --noEmit` passed.

### Step 18: Extract Navigation Availability Guards

Status: done

Goal: Move menu availability guard watchers out of `App.vue`.

Scope:
- Introduce a composable for returning to the local library when plugin views or the downloads view become unavailable.
- Keep actual navigation state in `useLibraryNavigation` and keep `returnToLocalLibrary` in `App.vue` for now because it also clears online playback/search state.
- Do not introduce Vue Router or change visible menu behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useNavigationAvailabilityGuards.ts` for plugin-view and downloads-view availability guard watchers.
- Updated `App.vue` to use the guard composable while keeping `returnToLocalLibrary` as the explicit cleanup/navigation callback.
- `npx vue-tsc --noEmit` passed.

### Step 19: Move Lyrics View Auto Sync Into Lyrics State

Status: done

Goal: Move the watcher that synchronizes lyrics view status for the active track out of `App.vue`.

Scope:
- Let `useLyricsState` own active-track lyric status synchronization because it already owns lyrics view state transitions.
- Remove the inline active-track/lyrics-count watcher from `App.vue`.
- Do not change lyrics loading, ready, empty, or error behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Updated `src/composables/useLyricsState.ts` so it owns active-track lyrics view status auto-sync.
- Removed the inline active-track/lyrics-count watcher from `App.vue` and dropped the now-unused `setLyricsViewState` binding there.
- `npx vue-tsc --noEmit` passed.

### Step 20: Extract Player Error Toast Bridge

Status: done

Goal: Move player error-to-toast bridging and toast timer cleanup out of `App.vue`.

Scope:
- Let `useOnlineToast` own its own timer cleanup on component unmount.
- Introduce a small composable that watches `player.error`, shows the toast, and clears the error.
- Do not change toast text, duration, or variant behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Updated `src/composables/useOnlineToast.ts` so it owns toast timer cleanup on unmount.
- Added `src/composables/usePlayerErrorToast.ts` for watching `player.error`, showing the toast, and clearing the error.
- Updated `App.vue` to use the bridge composable instead of owning the watcher and cleanup directly.
- `npx vue-tsc --noEmit` passed.

### Step 21: Extract Library Catalog View Model

Status: done

Goal: Move local library derived view data out of `App.vue`.

Scope:
- Introduce `useLibraryCatalog` for all visible tracks, folder-filtered tracks, recent tracks, visible tracks, folder cards, library title, and library counts.
- Keep artist grouping in `App.vue` for this step because `useLibraryNavigation` currently needs it during navigation setup.
- Keep navigation state in `useLibraryNavigation` and playback actions in `App.vue`.
- Do not change filtering, sorting, counts, or localized titles.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useLibraryCatalog.ts` for library visible tracks, folder/recent filtered tracks, folder cards, library title, and library counts.
- Updated `App.vue` to consume the catalog view model while keeping artist grouping in place for the existing navigation initialization dependency.
- `npx vue-tsc --noEmit` passed.

### Step 22: Move Artist Grouping Into Library Catalog

Status: done

Goal: Finish the library catalog extraction by moving artist grouping out of `App.vue`.

Scope:
- Change `useLibraryNavigation` to receive a default-artist callback instead of owning the artist group dependency directly.
- Move artist grouping into `useLibraryCatalog`.
- Do not change artist sorting or default artist selection behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Updated `src/composables/useLibraryNavigation.ts` to accept a default-artist callback instead of a direct artist-group computed dependency.
- Moved artist grouping and sorting into `src/composables/useLibraryCatalog.ts`.
- Updated `App.vue` to consume `artistGroups` from the library catalog and removed the now-unused `t` import.
- `npx vue-tsc --noEmit` passed.

### Step 23: Extract Local Lyrics Loader

Status: done

Goal: Move local lyrics request/cache/background-loading state out of `App.vue`.

Scope:
- Introduce `useLocalLyricsLoader` for local lyrics request de-duplication, local lyrics metadata cache, active-track local lyrics watcher, and playback lyric metadata derivation.
- Keep applying loaded lyrics to current playback/selection as an explicit callback owned by `App.vue`.
- Do not change local lyrics loading fallback, ready/empty status updates, or warning behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useLocalLyricsLoader.ts` for local lyrics request de-duplication, local lyrics metadata cache, active-track local lyrics watcher, and playback lyric metadata derivation.
- Updated `App.vue` to consume the loader and keep only the explicit callback that applies loaded lyrics to current playback/selection state.
- Removed unused `watch`, `resolveLocalTrackLyrics`, and `normalizeTrackLyrics` usage from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 24: Extract Playback Utility Helpers

Status: done

Goal: Move pure playback helper functions out of `App.vue`.

Scope:
- Introduce `src/utils/playback.ts` for remote-track detection, playback queue path normalization/deduplication, and playback error normalization.
- Update `App.vue` to import these helpers instead of defining them inline.
- Do not change playback queue identity, remote-track detection, or error text behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/utils/playback.ts` for remote-track detection, playback queue path normalization/deduplication, online error normalization, playback replacement detection, and playback error normalization.
- Updated `App.vue` to import these pure playback helpers instead of defining them inline.
- Preserved the existing error text fallback behavior while moving the helpers.
- `npx vue-tsc --noEmit` passed.

### Step 25: Extract Online Lyrics Loader

Status: done

Goal: Move online lyrics request de-duplication and background loading out of `App.vue`.

Scope:
- Introduce `useOnlineLyricsLoader` for online lyrics request de-duplication, plugin lyrics service calls, active-track guards, and ready/empty state updates.
- Keep applying loaded online lyrics to the active track as an explicit callback owned by `App.vue`.
- Do not change online lyrics loading fallback, active-track guard behavior, or warning behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useOnlineLyricsLoader.ts` for online lyrics request de-duplication, plugin lyrics service calls, active-track guards, and ready/empty state updates.
- Updated `App.vue` to consume the loader and keep only the explicit callback that applies loaded online lyrics to active track state.
- Removed direct `getPluginLyricsMetadata`, `pluginSearchTrackKey`, and online lyrics request cache ownership from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 26: Extract Window Drag Handler

Status: done

Goal: Move top-window drag platform behavior out of `App.vue`.

Scope:
- Introduce `useWindowDrag` for Tauri runtime guard, drag-region hit testing, and starting native window dragging.
- Update `App.vue` to bind the returned handler.
- Do not change the draggable region or skip-target behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useWindowDrag.ts` for Tauri runtime guard, drag-region hit testing, and native window dragging.
- Updated `App.vue` to bind the returned `startWindowDrag` handler while keeping `getCurrentWindow` only for system media raise/focus behavior.
- `npx vue-tsc --noEmit` passed.

### Step 27: Extract MCP Sleep Timer Request Bridge

Status: done

Goal: Move MCP sleep timer event-to-player-dock request bridging out of `App.vue`.

Scope:
- Introduce `useMcpSleepTimerRequest` for MCP sleep timer payload normalization, player sleep-timer action update, request state, and success toast.
- Keep the actual sleep timer countdown in `PlayerDock.vue`/`useSleepTimer`.
- Do not change request clamping, accepted actions, or toast behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useMcpSleepTimerRequest.ts` for MCP sleep timer payload normalization, player sleep-timer action update, request state, and success toast.
- Updated `App.vue` to use the bridge while keeping the actual sleep timer countdown in `PlayerDock.vue`/`useSleepTimer`.
- `npx vue-tsc --noEmit` passed.

### Step 28: Extract Downloaded Track Utilities

Status: done

Goal: Move pure downloaded-track conversion and matching helpers out of `App.vue`.

Scope:
- Introduce `src/utils/downloadedTrack.ts` for converting a download item to a playback track, finding a downloaded item for an online queue track, applying downloaded playback source, and checking downloaded local playback state.
- Update `App.vue` to import these helpers.
- Do not change downloaded playback queue behavior or matching rules.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/utils/downloadedTrack.ts` for converting downloaded items to tracks, matching downloaded items to online queue tracks, applying downloaded playback sources, and checking downloaded local playback state.
- Updated `App.vue` to import these helpers while keeping downloaded playback actions in the app orchestration layer.
- `npx vue-tsc --noEmit` passed.

### Step 29: Extract Track Runtime Metadata Utilities

Status: done

Goal: Move pure track runtime metadata merge and identity helpers out of `App.vue`.

Scope:
- Introduce `src/utils/trackRuntimeMetadata.ts` for merging runtime metadata, preserving online display paths, and comparing track metadata identity.
- Update `App.vue` to import these helpers while keeping app-specific candidate selection in place.
- Do not change queue snapshot merge behavior or metadata identity rules.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/utils/trackRuntimeMetadata.ts` for runtime metadata merging, online display path preservation, and track metadata identity checks.
- Updated `App.vue` to import these helpers while keeping app-specific candidate selection in `mergeQueueRuntimeMetadata`.
- `npx vue-tsc --noEmit` passed.

### Step 30: Extract Online Search Snapshot Bridge

Status: done

Goal: Move discover-page online search snapshot and error state out of `App.vue`.

Scope:
- Introduce `useOnlineSearchSnapshotBridge` for the discover search snapshot, derived open state, result list, error state, and snapshot/error reset helpers.
- Keep navigation changes and online playback orchestration in `App.vue`.
- Do not change discover search snapshot payloads or playback lookup behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useOnlineSearchSnapshotBridge.ts` for discover search snapshot state, derived open/results state, error state, and reset/update helpers.
- Updated `App.vue` to consume the bridge and read playback lookup data through `onlineSearchResults`.
- `npx vue-tsc --noEmit` passed.

### Step 31: Extract Lyrics View Visibility State

Status: done

Goal: Move lyrics panel open/close and transition visibility state out of `App.vue`.

Scope:
- Introduce `useLyricsViewVisibility` for `isLyricsOpen`, `isLyricsTransitioning`, `isLibraryVisible`, and transition handlers.
- Keep lyric seeking in `App.vue` because it may start playback or issue seek requests.
- Do not change lyrics panel transition behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useLyricsViewVisibility.ts` for lyrics panel open/close state and transition handlers.
- Updated `App.vue` to consume the visibility composable while keeping lyric seeking in the app playback boundary.
- `npx vue-tsc --noEmit` passed.

### Step 32: Extract Downloaded Track Actions

Status: done

Goal: Move downloaded-track UI actions out of `App.vue`.

Scope:
- Introduce `useDownloadedTrackActions` for queue-next, play downloaded track, add downloaded track to playlist, and download active online track actions.
- Keep Rust playback queue starting as an explicit callback owned by `App.vue`.
- Do not change downloaded playback queue construction or active online download behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useDownloadedTrackActions.ts` for queue-next, play downloaded track, add downloaded track to playlist, and download active online track actions.
- Updated `App.vue` to consume the downloaded-track action composable while keeping Rust playback queue starting as an explicit callback.
- Removed the now-unused `DownloadItem` type import from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 33: Extract Favorite Track Actions

Status: done

Goal: Move favorite-track action handling out of `App.vue`.

Scope:
- Introduce `useFavoriteTrackActions` for active-track favorite state, toggling favorites, adding favorites from context menus, and removing unfavorited tracks from the favorites queue view.
- Keep Rust queue removal as an explicit callback owned by `App.vue`.
- Do not change favorite toggling or favorites-view queue cleanup behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useFavoriteTrackActions.ts` for active-track favorite state, toggling favorites, adding tracks to favorites, and favorites-view queue cleanup.
- Updated `App.vue` to consume the favorite action composable while keeping Rust queue removal as an explicit callback.
- `npx vue-tsc --noEmit` passed.

### Step 34: Extract Track Lyrics Mutation Actions

Status: done

Goal: Move active-track lyrics mutation and clearing logic out of `App.vue`.

Scope:
- Introduce `useTrackLyricsMutation` for applying source/associated lyrics to the active track across current playback, selected track, online active track, library tracks, player queue, and Rust queue.
- Keep lyrics loading in the existing local/online lyrics loader composables.
- Do not change lyrics metadata merge, artwork fallback, or clear-lyrics behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useTrackLyricsMutation.ts` for applying source/associated lyrics and clearing associated lyrics across active, selected, current playback, online active, library, player queue, and Rust queue state.
- Updated `App.vue` to consume the mutation composable while leaving local/online lyrics loading in their loader composables.
- Removed the now-unused `isSameTrackForMetadata` import from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 35: Extract Rust Queue Commands

Status: done

Goal: Move small Rust queue command actions out of `App.vue`.

Scope:
- Introduce `useRustQueueCommands` for syncing playback mode, toggling playback mode, setting playback mode, and removing tracks from the Rust queue.
- Keep Rust queue startup, restore, snapshot merge, next/previous, and failure handling in `App.vue` for now.
- Do not change playback mode or remove-from-queue behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useRustQueueCommands.ts` for playback mode sync/toggle/set and removing tracks from the Rust queue.
- Updated `App.vue` to consume the command composable while keeping Rust queue startup, restore, snapshot merge, next/previous, and failure handling in place.
- Removed the now-unused `getErrorMessage` import from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 36: Extract Online Playback Lookup Helpers

Status: done

Goal: Move online playback lookup, key, and queue-building helpers out of `App.vue`.

Scope:
- Introduce `useOnlinePlaybackLookup` for online track keys, next search result lookup, plugin-track lookup for queue tracks, online playback queue building, and queue-switch cleanup.
- Pass the shared online track key helper into `useOnlineLyricsLoader` so key rules stay in one place.
- Keep `playOnlineTrack`, quality switching, and Rust playback start/failure handling in `App.vue` for now.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useOnlinePlaybackLookup.ts` for online track keys, next search result lookup, plugin-track lookup for queue tracks, online playback queue building, and queue-switch cleanup.
- Updated `src/composables/useOnlineLyricsLoader.ts` to accept the shared online track key helper instead of defining its own key function.
- Updated `App.vue` to consume the lookup composable while keeping online playback, quality switching, and Rust playback failure handling in place.
- `npx vue-tsc --noEmit` passed.

### Step 37: Extract Online Playback Controller

Status: done

Goal: Move online playback start, failure fallback, and quality switching out of `App.vue`.

Scope:
- Introduce `useOnlinePlaybackController` for `playOnlineTrack`, online playback failure handling, and online quality switching.
- Keep Rust queue startup and snapshot reconciliation as explicit callbacks so the Rust playback lifecycle remains owned by `App.vue` for now.
- Do not change online playback fallback behavior, toast text, resolving indicators, or quality validation.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useOnlinePlaybackController.ts` for online playback start, failure fallback, and quality switching.
- Updated `App.vue` to consume the online playback controller while keeping Rust queue startup and snapshot reconciliation as explicit callbacks.
- Removed the online playback controller functions from `App.vue` without changing template events or playback fallback behavior.
- `npx vue-tsc --noEmit` passed.

### Step 38: Extract Content Navigation Actions

Status: done

Goal: Move content-area navigation actions and online-search cleanup out of `App.vue`.

Scope:
- Introduce `useContentNavigationActions` for returning to the local library, opening folders/recent-added from panels, opening discover music, and reacting to online search start.
- Keep the underlying `useLibraryNavigation` state model unchanged.
- Preserve online search snapshot cleanup and resolving-track reset behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useContentNavigationActions.ts` for content-area navigation actions and online-search cleanup.
- Updated `App.vue` to consume the navigation action composable and register navigation availability guards after the action boundary is assembled.
- Removed the content navigation wrapper functions from `App.vue` while keeping the underlying `useLibraryNavigation` state model unchanged.
- `npx vue-tsc --noEmit` passed.

### Step 39: Extract Local Playback Actions

Status: done

Goal: Move local list playback actions out of `App.vue`.

Scope:
- Introduce `useLocalPlaybackActions` for playing a local track, playing the current visible list, and playing an item from the Rust queue.
- Keep Rust queue startup, restore, next/previous, failure handling, and active-track seeking in `App.vue`.
- Preserve existing local playback error messages and queue selection behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useLocalPlaybackActions.ts` for playing a local track, playing the current visible list, and playing an item from the Rust queue.
- Updated `App.vue` to consume the local playback action composable while keeping Rust queue startup and failure handling in place.
- Removed the local playback action functions from `App.vue` without changing emitted event handlers or local playback error messages.
- `npx vue-tsc --noEmit` passed.

### Step 40: Extract Downloaded Online Playback Fallback

Status: done

Goal: Move downloaded-online playback source mapping and plugin fallback retry out of `App.vue`.

Scope:
- Introduce `useDownloadedOnlinePlaybackFallback` for mapping online queue tracks to downloaded local files and retrying a downloaded online track through its plugin source.
- Keep playback failure orchestration in `App.vue` so stop/next/toast behavior remains in the main Rust playback flow.
- Preserve fallback queue construction and downloaded-track detection behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useDownloadedOnlinePlaybackFallback.ts` for downloaded online playback source mapping and plugin-source retry.
- Updated `App.vue` to consume the fallback composable and removed direct downloaded-track wrapper/fallback functions.
- Removed now-unneeded direct imports of downloaded-track helpers, online identity comparison, and `queueSourceKey` from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 41: Extract Playback Lyrics Actions

Status: done

Goal: Move playback lyric format switching and local lyric application out of `App.vue`.

Scope:
- Introduce `usePlaybackLyricsActions` for changing the active lyric format and applying local lyric results to the current/selected local track.
- Keep lyric loading, lyric metadata derivation, desktop lyric sync, and lyric seek behavior in their current boundaries.
- Preserve lyric format validation, toast behavior, and current-track lyric merge rules.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/usePlaybackLyricsActions.ts` for active lyric format switching and local lyric application.
- Updated `App.vue` to consume the lyrics action composable using small deferred getter/setter bridges so the existing lyric loading and format derivation order stays intact.
- Removed the lyric format switching and local lyric application functions from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 42: Extract External Playback Actions

Status: done

Goal: Move tray, desktop lyrics, and system media command dispatch out of `App.vue`.

Scope:
- Introduce `useExternalPlaybackActions` for translating tray menu actions, desktop lyrics actions, and system media actions into playback/navigation commands.
- Keep the actual Rust previous/next handlers, playback mode commands, app close behavior, and seek request refs as explicit inputs.
- Preserve toggle, seek, raise, quit, and settings behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useExternalPlaybackActions.ts` for tray menu, desktop lyrics, and system media command dispatch.
- Updated `App.vue` to consume the external action composable and pass Rust previous/next, playback mode, seek refs, settings navigation, and app-close behavior as explicit inputs.
- Removed direct `getCurrentWindow`, `DesktopLyricsAction`, and `SystemMediaAction` dependencies and the three external command handler functions from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 43: Extract Track Interaction Actions

Status: done

Goal: Move simple track selection and online track context-menu actions out of `App.vue`.

Scope:
- Introduce `useTrackInteractionActions` for selecting a track, opening an online search track in the existing track context menu, and queueing a context track next.
- Keep playlist mutations and context menu ownership in their existing composables.
- Preserve online queue-track conversion and plugin-track lookup behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useTrackInteractionActions.ts` for track selection, online track context-menu opening, and queue-next-from-context behavior.
- Updated `App.vue` to consume the track interaction composable while leaving playlist action ownership in `usePlaylistActions`.
- Removed the corresponding simple interaction functions and no-longer-needed `PluginSearchTrack`/online queue-track conversion imports from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 44: Extract Rust Playback Transport Actions

Status: done

Goal: Move Rust previous/next commands and playback-failure fallback handling out of `App.vue`.

Scope:
- Introduce `useRustPlaybackTransport` for previous track, next track, and playback failure handling.
- Keep Rust queue startup, restore, snapshot merge, and seamless advance in `App.vue` for now.
- Preserve request-replaced handling, queue switching cleanup, downloaded-online fallback retry, toast messages, and online failure action behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useRustPlaybackTransport.ts` for Rust previous/next commands and playback-failure fallback handling.
- Updated `App.vue` to consume the transport composable while keeping Rust queue startup, restore, snapshot merge, and seamless advance in place.
- Removed the previous/next/failure handler functions and no-longer-needed direct Rust previous/next service imports from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 45: Extract Active Playback Seek Actions

Status: done

Goal: Move active-track playback start and lyric seek behavior out of `App.vue`.

Scope:
- Introduce `useActivePlaybackSeekActions` for starting the active track and seeking from lyrics.
- Keep Rust queue startup and queue snapshot handling in `App.vue` as explicit callbacks.
- Preserve active queue selection, seek request refs, request-replaced handling, and playback-failure toast behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useActivePlaybackSeekActions.ts` for active-track playback start and lyric seek behavior.
- Updated `App.vue` to consume the active playback seek composable while keeping Rust queue startup and queue snapshot handling as callbacks.
- Removed the active playback start and lyric seek functions from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 46: Extract Rust Queue Snapshot Track Resolver

Status: done

Goal: Move the pure current-track lookup logic for Rust queue snapshots out of `App.vue`.

Scope:
- Introduce a utility for resolving the active `Track` from a `RustQueueSnapshot` and merged playback tracks.
- Keep queue snapshot state mutation and seamless advance behavior in `App.vue`.
- Preserve current-source path matching, normalized queue-source matching, and current-index fallback behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/utils/rustQueueSnapshot.ts` with `resolveRustQueueSnapshotTrack` for current-source/current-index snapshot matching.
- Updated `App.vue` to use the snapshot resolver utility while keeping queue state mutation and seamless advance behavior in place.
- Removed the no-longer-needed direct `normalizePath` and `normalizedQueueSourceKey` imports from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 47: Extract Rust Playback Lifecycle

Status: done

Goal: Move Rust queue start/restore backend lifecycle implementation out of `App.vue`.

Scope:
- Introduce `useRustPlaybackLifecycle` for starting the Rust queue, restoring the Rust queue, and tracking restore-in-progress state.
- Keep thin wrapper function declarations in `App.vue` so existing composable setup order and callback identity stay stable.
- Preserve deduplication, request-replaced handling, restore playback time updates, fallback queue assignment, and crossfade settings.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useRustPlaybackLifecycle.ts` for Rust queue start, Rust queue restore, and restore-in-progress tracking.
- Updated `App.vue` to consume the lifecycle composable while keeping thin wrapper function declarations for existing setup-order stability.
- Moved start/restore backend calls, request-replaced handling, restore playback time updates, fallback queue assignment, and crossfade settings usage out of `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 48: Extract Rust Queue Snapshot Controller

Status: done

Goal: Move Rust queue snapshot merge and seamless-advance state transitions out of `App.vue`.

Scope:
- Introduce `useRustQueueSnapshotController` for runtime metadata merge, snapshot queue reconciliation, and seamless advance handling.
- Keep a thin `handleRustQueueSnapshot` wrapper in `App.vue` so existing callback setup order stays stable.
- Preserve online/local active-track state updates, lyric background loading, queue switching indicators, lyrics view sync, and recently-played recording.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useRustQueueSnapshotController.ts` for runtime metadata merge, queue snapshot reconciliation, and seamless advance handling.
- Updated `App.vue` to consume the snapshot controller while keeping thin `handleRustQueueSnapshot` and `handleSeamlessAdvance` wrappers for existing event/template bindings.
- Removed direct snapshot track resolving, runtime metadata merge, and queue source comparison dependencies from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 49: Move Preparing Playback Cleanup To Active Track State

Status: done

Goal: Let active-track state own the cleanup action for preparing/resolving playback indicators.

Scope:
- Move `clearPreparingPlaybackState` into `useActiveTrackState`, where `onlineResolvingTrackKey` and `queueSwitchingTrackKey` are created.
- Update `App.vue` to consume the returned cleanup action instead of defining it locally.
- Preserve existing resolving and queue-switching cleanup behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `clearPreparingPlaybackState` to `useActiveTrackState`, alongside the resolving and queue-switching refs it clears.
- Updated `App.vue` to consume the cleanup action from active-track state and removed the local cleanup function.
- `npx vue-tsc --noEmit` passed.

### Step 50: Extract Active Track UI State

Status: done

Goal: Move active-track display/permission computed state out of `App.vue`.

Scope:
- Introduce `useActiveTrackUiState` for lyric-format visibility, active online download status, and local track context action permissions.
- Keep the actual metadata dialog actions, download actions, and playback actions in their existing composables.
- Preserve current visibility and permission rules.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useActiveTrackUiState.ts` for lyric-format visibility, active online download status, and local track context action permissions.
- Updated `App.vue` to consume the UI-state composable and removed the corresponding inline computed state.
- `npx vue-tsc --noEmit` passed.

### Step 51: Internalize Playback Lyric Action Context

Status: done

Goal: Remove the remaining lyric-format bridge functions from `App.vue`.

Scope:
- Let `usePlaybackLyricsActions` register playback lyric format/metadata context after `usePlaybackLyricFormat` is created.
- Remove `getCurrentPlaybackLyricFormat`, `getCurrentPlaybackLyricMetadata`, and `setPlaybackSelectedLyricFormat` from `App.vue`.
- Preserve the existing setup order for local lyric loading and lyric format derivation.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Updated `usePlaybackLyricsActions` to register playback lyric format/metadata context after lyric format state is created.
- Removed `getCurrentPlaybackLyricFormat`, `getCurrentPlaybackLyricMetadata`, and `setPlaybackSelectedLyricFormat` from `App.vue` without changing the local lyric loading setup order.
- `npx vue-tsc --noEmit` passed.

### Step 52: Extract Sleep Timer Exit Action

Status: done

Goal: Move sleep-timer-triggered app exit behavior out of `App.vue`.

Scope:
- Introduce `useSleepTimerExitAction` for saving playback session state and exiting the app when the sleep timer requests exit.
- Keep sleep timer countdown/runtime behavior in `PlayerDock.vue` and `useSleepTimer`.
- Preserve existing save-before-exit behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/useSleepTimerExitAction.ts` for save-before-exit sleep timer behavior.
- Updated `App.vue` to consume the sleep timer exit action and removed its direct `exitApp` dependency.
- `npx vue-tsc --noEmit` passed.

### Step 53: Remove Seamless Advance Wrapper

Status: done

Goal: Remove the last template-only seamless advance wrapper from `App.vue`.

Scope:
- Bind the player dock seamless-advance event directly to `useRustQueueSnapshotController`.
- Keep Rust queue snapshot, start/restore, and app-close wrappers in `App.vue` because they protect existing setup-order callback stability.
- Preserve seamless advance behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Updated `App.vue` to bind `PlayerDock` seamless-advance directly to `rustQueueSnapshotController.handleSeamlessAdvance`.
- Removed the template-only `handleSeamlessAdvance` wrapper from `App.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 54: Extract Plugin Center Tabs And Rows

Status: done

Goal: Move plugin center tab state and plugin row derivation out of `PluginManagerView.vue`.

Scope:
- Introduce `usePluginCenterTabs` for active plugin center tab state and tab selection.
- Introduce `usePluginRows` for merging installed/catalog plugin data into visible table rows.
- Keep plugin catalog loading, installation actions, subscriptions, and drag sorting in their current boundaries for this step.
- Preserve existing tab labels, selection rules, deleted-plugin filtering, and row shape.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/usePluginCenterTabs.ts` for plugin center tab state and selection.
- Added `src/composables/usePluginRows.ts` for installed/catalog plugin row derivation and deleted-plugin filtering.
- Updated `PluginManagerView.vue` to consume the two composables and removed the inline tab/visible row state.
- `npx vue-tsc --noEmit` passed.

### Step 55: Extract Plugin Catalog State

Status: done

Goal: Move plugin installed/catalog/deleted state and loading helpers out of `PluginManagerView.vue`.

Scope:
- Introduce `usePluginCatalogState` for installed plugins, catalog plugins, official catalog plugins, deleted plugin ids, loading flags, catalog merging, and refresh helpers.
- Keep the page's mount ordering in `PluginManagerView.vue` so subscription loading and drag cleanup stay explicit for this step.
- Preserve official catalog refresh, cached catalog loading, focus refresh, pruning, and catalog merge sorting behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `src/composables/usePluginCatalogState.ts` for installed/catalog/deleted plugin state, official catalog refresh, cached catalog loading, focus refresh, and merge sorting.
- Updated `PluginManagerView.vue` to consume catalog state helpers while keeping mount ordering and drag cleanup explicit.
- Removed direct plugin catalog service imports and inline loading helper functions from `PluginManagerView.vue`.
- `npx vue-tsc --noEmit` passed.

### Step 56: Extract Installed Plugins Panel

Status: done

Goal: Move the installed-plugins tab template out of `PluginManagerView.vue`.

Scope:
- Introduce `PluginInstalledPanel.vue` to compose bulk actions and the plugin table for the installed tab.
- Keep selection, install, drag-sort, and row derivation logic in existing composables.
- Preserve installed tab props/events and styling.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `PluginInstalledPanel.vue` to own the installed plugin tab panel structure.
- Replaced the installed-tab inline template in `PluginManagerView.vue` with `PluginInstalledPanel`.
- Moved installed panel layout styling into the child component and removed parent-owned selectors.
- Verified with `npx vue-tsc --noEmit`.

### Step 57: Extract Plugin Subscriptions Panel

Status: done

Goal: Move the subscription management tab template out of `PluginManagerView.vue`.

Scope:
- Introduce `PluginSubscriptionsPanel.vue` for subscription loading, empty, and card-list UI.
- Keep subscription data loading and mutation logic in `usePluginSubscriptions`.
- Preserve subscription card props/events and local install button behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `PluginSubscriptionsPanel.vue` to own the subscription form, subscription list, row actions, empty state, and local install button UI.
- Replaced the subscriptions inline template in `PluginManagerView.vue` with `PluginSubscriptionsPanel`.
- Moved subscription panel styles into the child component and removed parent-owned subscription selectors.
- Verified with `npx vue-tsc --noEmit`.

### Step 58: Extract Plugin Market Category Sidebar

Status: done

Goal: Move plugin marketplace category navigation out of `PluginManagerView.vue`.

Scope:
- Introduce `PluginMarketSidebar.vue` for category buttons and category icons.
- Keep category data and selected category state in `usePluginMarket`.
- Preserve sidebar styling in the extracted component.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `PluginMarketSidebar.vue` for marketplace category buttons and icons.
- Replaced the inline category sidebar in `PluginManagerView.vue` with `PluginMarketSidebar`.
- Moved sidebar desktop and mobile styles into the child component.
- Verified with `npx vue-tsc --noEmit`.

### Step 59: Extract Plugin Market Main List

Status: done

Goal: Move plugin marketplace search, status filters, loading state, and plugin list cards out of `PluginManagerView.vue`.

Scope:
- Introduce `PluginMarketMain.vue` for the central market list UI.
- Keep search text, selected filter, selected plugin, and install/update actions in `usePluginMarket`.
- Preserve current plugin card props/events and scoped list styling.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `PluginMarketMain.vue` for marketplace search, status filters, loading/empty states, and plugin list cards.
- Replaced the inline market main list in `PluginManagerView.vue` with `PluginMarketMain`.
- Moved market main list styles into the child component while leaving detail-only styling in the parent for the next step.
- Verified with `npx vue-tsc --noEmit`.

### Step 60: Extract Plugin Market Detail Panel

Status: done

Goal: Move the selected marketplace plugin detail sidebar out of `PluginManagerView.vue`.

Scope:
- Introduce `PluginMarketDetailPanel.vue` for selected plugin details, action button, permissions, highlights, metadata, and screenshots.
- Keep selected plugin state, screenshot index, and install/update actions in `usePluginMarket`.
- Move detail panel scoped styles into the child component.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `PluginMarketDetailPanel.vue` for selected plugin details, action button, permissions, highlights, metadata, and screenshots.
- Replaced the inline market detail sidebar in `PluginManagerView.vue` with `PluginMarketDetailPanel`.
- Moved detail panel styles into the child component and removed parent-owned detail selectors.
- Verified with `npx vue-tsc --noEmit`.

### Step 61: Compose Plugin Market Panel

Status: done

Goal: Move the marketplace shell layout out of `PluginManagerView.vue`.

Scope:
- Introduce `PluginMarketPanel.vue` to compose sidebar, main list, and detail panel.
- Keep marketplace state and commands in `usePluginMarket`.
- Move marketplace shell responsive layout styles into the panel component.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `PluginMarketPanel.vue` to compose the market sidebar, main list, and detail panel.
- Replaced the market shell in `PluginManagerView.vue` with `PluginMarketPanel`.
- Moved market shell layout and responsive column styles into the panel component.
- Verified with `npx vue-tsc --noEmit`.

### Step 62: Remove AppLayout Child Selector Coupling

Status: done

Goal: Reduce layout/page CSS coupling caused by `AppLayout.vue` reaching into child component class names.

Scope:
- Inspect `AppLayout.vue` deep selectors and identify which belong to page/content components.
- Move child-specific layout rules to the owning page or panel when safe.
- Preserve global shell layout behavior for side menu, main content, and player dock.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added an explicit `app-layout-content` wrapper around the default slot in `AppLayout.vue`.
- Moved grid-column placement from child class `:deep()` selectors to layout-owned variant selectors on `app-layout-content`.
- Removed `AppLayout.vue` deep selectors against settings, theme, plugin, download, discover, search, workspace, and artists page class names.
- Verified with `npx vue-tsc --noEmit`.

### Step 63: Audit AppMainContent Page Dispatch

Status: done

Goal: Identify the next safe cut in `AppMainContent.vue` now that layout/container coupling is reduced.

Scope:
- Inspect page dispatch branches and prop/event surfaces.
- Prefer a narrow extraction only if it clearly reduces page dispatch coupling without introducing speculative routing.
- Keep current `activeView` state navigation unless a stronger local reason appears.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `AppMainContent.vue` is now about 299 lines and primarily combines layout composition with manual page dispatch.
- Current `activeView` navigation remains acceptable for this desktop app; no router migration is needed for this step.
- The next safe extraction is a page outlet component that owns page branch rendering and event forwarding.
- Verified current state with `npx vue-tsc --noEmit`.

### Step 64: Extract App Page Outlet

Status: done

Goal: Separate page dispatch from `AppMainContent.vue` layout composition.

Scope:
- Introduce `AppPageOutlet.vue` to render library, discover, workspace, artists, downloads, theme, plugin, and settings pages.
- Keep `AppMainContent.vue` responsible for `AppLayout`, `PrimarySidebar`, and layout variant selection.
- Preserve existing props and events without changing navigation behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `AppPageOutlet.vue` to own page branch rendering and page-level event forwarding.
- Updated `AppMainContent.vue` to keep only `AppLayout`, `PrimarySidebar`, layout variant selection, and outlet wiring.
- Reduced `AppMainContent.vue` from about 299 lines to about 231 lines without changing `activeView` navigation behavior.
- Verified with `npx vue-tsc --noEmit`.

### Step 65: Audit Remaining Frontend Architecture Risks

Status: done

Goal: Re-scan the frontend after the latest extractions and decide whether another surgical refactor is warranted now.

Scope:
- Check largest Vue components and remaining deep selectors.
- Identify risks that are still concrete rather than speculative.
- Continue only with a small, verifiable step if the next boundary is clear.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Largest remaining components are now shared display surfaces (`TrackTable.vue`, `LyricsView.vue`, settings panels, `PlayerDock.vue`) rather than the previously oversized plugin manager.
- `AppLayout.vue` no longer has deep child selectors; remaining deep selectors are mostly component-local integrations such as context menus, dialogs, track table styling, and `SegmentTabs` variants.
- `PluginManagerView.vue` still owns `SegmentTabs` styling through deep selectors for `plugin-center-tabs`; this is a small concrete cleanup.
- Verified current state with `npx vue-tsc --noEmit`.

### Step 66: Move Plugin Center Tab Styling Into SegmentTabs

Status: done

Goal: Remove the remaining `SegmentTabs` deep styling from `PluginManagerView.vue`.

Scope:
- Add `plugin-center-tabs` styling to `SegmentTabs.vue`, consistent with existing `download-tabs`, `settings-tabs`, and `theme-tabs` variants.
- Remove `:deep(.plugin-center-tabs...)` selectors from `PluginManagerView.vue`.
- Preserve the plugin center tab appearance and behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `plugin-center-tabs` styling to `SegmentTabs.vue`, matching the existing variant-style pattern used by other tabs.
- Removed `:deep(.plugin-center-tabs...)` selectors from `PluginManagerView.vue`.
- Verified with `npx vue-tsc --noEmit`.

### Step 67: Final Verification And Remaining Recommendations

Status: done

Goal: Verify the current refactor set and capture what should remain for a future pass.

Scope:
- Run frontend type checking.
- Inspect changed files and high-level remaining architecture risks.
- Do not start a broad new refactor without a clear boundary.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Final verification passed with `npx vue-tsc --noEmit`.
- Current largest Vue components are shared/complex surfaces such as `TrackTable.vue`, `LyricsView.vue`, settings panels, `PlayerDock.vue`, and plugin market subcomponents.
- Remaining deep selectors are component-local integrations (`BaseContextMenu`, dialogs, `DownloadManagerView` track-table styling, `LibraryContentLayout`, lyrics stage, `SearchInput`) rather than `AppLayout` reaching into page classes.
- Recommended future passes: split `TrackTable.vue` row/actions/virtual list concerns, reduce `LyricsView.vue` stage/control coupling, and group flat composables by domain once behavior stabilizes.

### Step 68: Audit TrackTable Split Boundary

Status: done

Goal: Find the smallest safe extraction inside `TrackTable.vue`.

Scope:
- Inspect `TrackTable.vue` responsibilities, template sections, and style ownership.
- Prefer extracting display-only row/action UI before touching paging, scrolling, or playback selection behavior.
- Continue only if the boundary is clear and verifiable.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `TrackTable.vue` combines paging/scroll exposure, row selection/context menu behavior, row rendering, row actions, and table layout styles.
- Paging, `scrollToTrack`, row refs, and slots are behavior-sensitive and should stay in place for this pass.
- The smallest safe extraction is the per-row favorite/download action UI because it is display-only plus event forwarding.

### Step 69: Extract Track Row Actions

Status: done

Goal: Move favorite/download row action buttons out of `TrackTable.vue`.

Scope:
- Introduce `TrackRowActions.vue` for the row action buttons and their button-specific styles.
- Keep row selection, context menu, paging, row refs, and track state derivation in `TrackTable.vue`.
- Preserve existing favorite/download emits and disabled/loading states.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `TrackRowActions.vue` for favorite and download row buttons.
- Replaced inline row action buttons in `TrackTable.vue` with `TrackRowActions`.
- Moved action button scoped styles and download spinner animation into the child component.
- Verified with `npx vue-tsc --noEmit`.

### Step 70: Extract Track Table Header

Status: done

Goal: Move the table header row out of `TrackTable.vue` while preserving table layout ownership.

Scope:
- Introduce `TrackTableHeader.vue` for the header labels, optional cover spacer, extra header slot, and action header icons.
- Keep grid column sizing and responsive table layout styles in `TrackTable.vue`.
- Preserve current locale labels and optional download/action header behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `TrackTableHeader.vue` for header labels, cover spacer, optional extra header slot, and action header icons.
- Replaced the inline header row in `TrackTable.vue` with `TrackTableHeader`.
- Moved header-specific scoped styles to the child component while keeping table grid column sizing in `TrackTable.vue`.
- Verified with `npx vue-tsc --noEmit`.

### Step 71: Extract Track Title Cell

Status: done

Goal: Move the row title cell cover/title rendering out of `TrackTable.vue`.

Scope:
- Introduce `TrackTitleCell.vue` for optional cover thumbnail and title text.
- Keep row click, row selection, context menu, paging, and active-track derivation in `TrackTable.vue`.
- Preserve cover loading/playing/spectrum props and title truncation styling.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `TrackTitleCell.vue` for cover thumbnail and title text rendering.
- Replaced the inline row title cell in `TrackTable.vue` with `TrackTitleCell`.
- Moved title-cell scoped styles into the child component while keeping row/grid layout rules in `TrackTable.vue`.
- Verified with `npx vue-tsc --noEmit`.

### Step 72: Audit TrackTable After Display Extractions

Status: done

Goal: Decide whether another `TrackTable.vue` extraction is still safe in this pass.

Scope:
- Re-check `TrackTable.vue` size and remaining responsibilities.
- Avoid touching paging, row refs, exposed methods, context menu, or slot layout without a stronger reason.
- Capture next recommended boundary if broad behavior remains coupled.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `TrackTable.vue` is now about 454 lines after extracting row actions, header, and title cell.
- Remaining core responsibilities are row behavior, row refs, exposed paging/scroll methods, table grid sizing, responsive rules, and a few simple cells.
- Another safe display-only boundary remains: the artist cell, including optional link semantics and keyboard activation.
- Verified current state with `npx vue-tsc --noEmit`.

### Step 73: Extract Track Artist Cell

Status: done

Goal: Move artist cell display/link behavior out of `TrackTable.vue`.

Scope:
- Introduce `TrackArtistCell.vue` for linked or plain artist display.
- Keep row click, context menu, selection, paging, and unknown-artist fallback ownership in `TrackTable.vue`.
- Preserve click/keyboard behavior for opening artist detail.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `TrackArtistCell.vue` for linked or plain artist display.
- Replaced inline artist cell branches in `TrackTable.vue` with `TrackArtistCell`.
- Moved artist link scoped styles into the child component.
- Verified with `npx vue-tsc --noEmit`.

### Step 74: Final TrackTable Verification

Status: done

Goal: Verify the `TrackTable.vue` display extractions and capture the remaining higher-risk boundary.

Scope:
- Run type checking after the latest table display extractions.
- Inspect current `TrackTable.vue` size and remaining responsibilities.
- Stop short of row-component extraction unless the slot/layout contract is explicitly redesigned.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Final verification passed with `npx vue-tsc --noEmit`.
- `TrackTable.vue` is now about 413 lines, reduced from about 612 lines at the start of this pass.
- Extracted display-only table pieces: `TrackRowActions.vue`, `TrackTableHeader.vue`, `TrackTitleCell.vue`, and `TrackArtistCell.vue`.
- Remaining `TrackTable.vue` responsibilities are behavior-sensitive: row refs, paging, `scrollToTrack`, context menu selection, slot layout, and responsive grid/nth-child rules.
- Recommended next table pass: redesign the row slot contract before extracting a full `TrackTableRow.vue`.

### Step 75: Audit LyricsView Split Boundary

Status: done

Goal: Find the smallest safe extraction inside `LyricsView.vue`.

Scope:
- Inspect `LyricsView.vue` template, state, and style responsibilities.
- Prefer extracting display-only controls or panels before touching lyric scrolling, active-line synchronization, or playback state.
- Continue only if the boundary is clear and verifiable.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `LyricsView.vue` already delegates header, action menu, search dialog, cover panel, and lyrics panel to child components.
- The safest remaining extraction is the center stage layout that composes `LyricsCoverPanel` and `LyricsPanel`.
- This extraction can remove the `LyricsView.vue` deep selectors for child roots without touching lyric scrolling, active-line synchronization, or track loading.

### Step 76: Extract Lyrics Stage

Status: done

Goal: Move the center lyrics stage layout out of `LyricsView.vue`.

Scope:
- Introduce `lyrics/LyricsStage.vue` to compose `LyricsCoverPanel` and `LyricsPanel`.
- Keep lyric state, scrolling composable, current line calculation, cover loading, and search/menu orchestration in `LyricsView.vue`.
- Move stage grid styles into `LyricsStage.vue` and remove `LyricsView.vue` deep selectors.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `lyrics/LyricsStage.vue` to compose `LyricsCoverPanel` and `LyricsPanel`.
- Replaced the inline center stage template in `LyricsView.vue` with `LyricsStage`.
- Moved stage grid styles into `LyricsStage.vue` and removed `LyricsView.vue` deep selectors for cover/panel placement.
- Verified with `npx vue-tsc --noEmit`.

### Step 77: Audit LyricsView After Stage Extraction

Status: done

Goal: Decide whether another `LyricsView.vue` extraction is still safe in this pass.

Scope:
- Re-check `LyricsView.vue` size, remaining template sections, and composable orchestration.
- Avoid touching lyric loading, scroll synchronization, search, or association behavior without a clear boundary.
- Capture the next safe boundary if present.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `LyricsView.vue` is now about 421 lines after extracting `LyricsStage.vue`.
- Remaining large template blocks are the action menu Teleport and search dialog Teleport.
- Lyric loading, scroll synchronization, highlighting, cover lifecycle, and association behavior remain behavior-sensitive and should stay in `LyricsView.vue` for this pass.
- The next safe boundary is the action menu overlay wrapper.
- Verified current state with `npx vue-tsc --noEmit`.

### Step 78: Extract Lyrics Action Menu Overlay

Status: done

Goal: Move the action menu Teleport wrapper out of `LyricsView.vue`.

Scope:
- Introduce `lyrics/LyricsActionMenuOverlay.vue` to own the Teleport and `LyricsActionMenu` wiring.
- Keep menu state, download actions, fullscreen actions, and player dock commands in `LyricsView.vue`.
- Preserve all action menu props/events.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `lyrics/LyricsActionMenuOverlay.vue` to own the action menu Teleport and menu prop/event wiring.
- Replaced the inline action menu Teleport in `LyricsView.vue` with `LyricsActionMenuOverlay`.
- Kept menu state and all actions in `LyricsView.vue`.
- Verified with `npx vue-tsc --noEmit`.

### Step 79: Extract Lyrics Search Dialog Overlay

Status: done

Goal: Move the lyric search dialog Teleport wrapper out of `LyricsView.vue`.

Scope:
- Introduce `lyrics/LyricsSearchDialogOverlay.vue` to own the Teleport and `LyricsSearchDialog` wiring.
- Keep search state and search/apply actions in `LyricsView.vue`.
- Preserve query v-model and search dialog props/events.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `lyrics/LyricsSearchDialogOverlay.vue` to own the search dialog Teleport and dialog prop/event wiring.
- Replaced the inline search dialog Teleport in `LyricsView.vue` with `LyricsSearchDialogOverlay`.
- Kept search state and search/apply actions in `LyricsView.vue`.
- Verified with `npx vue-tsc --noEmit`.

### Step 80: Final LyricsView Verification

Status: done

Goal: Verify the `LyricsView.vue` extractions and capture remaining risks.

Scope:
- Run type checking after the latest lyrics view extractions.
- Inspect current `LyricsView.vue` size and remaining orchestration responsibilities.
- Stop short of moving behavior-heavy composable orchestration unless a new boundary is clear.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Final verification passed with `npx vue-tsc --noEmit`.
- `LyricsView.vue` is now about 417 lines and no longer owns the center stage layout or Teleport wrappers directly.
- Extracted lyrics display/overlay pieces: `lyrics/LyricsStage.vue`, `lyrics/LyricsActionMenuOverlay.vue`, and `lyrics/LyricsSearchDialogOverlay.vue`.
- Remaining `LyricsView.vue` responsibilities are orchestration-heavy: lyric loading, cover lifecycle, search state, association actions, fullscreen/menu state, highlight calculation, and scroll synchronization.
- Recommended next lyrics pass: group these orchestration responsibilities into a higher-level lyrics controller composable only after defining clear inputs/outputs.

### Step 81: Audit Settings And Player Control Split Boundary

Status: done

Goal: Find the next small, safe frontend extraction after the lyrics pass.

Scope:
- Inspect current largest Vue components and identify concrete responsibilities.
- Prefer extracting display-only settings/control UI before touching playback behavior.
- Continue only if the boundary is clear and verifiable.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Current largest components are `PlaybackSettingsPanel.vue`, `SleepTimerControl.vue`, `LyricsView.vue`, `TrackMetadataDialog.vue`, and `PlayerDock.vue`.
- `PlaybackSettingsPanel.vue` mixes settings UI with audio cache service calls and output device loading.
- The smallest safe next boundary is extracting audio cache state/actions from the settings panel into a composable while leaving template structure unchanged.

### Step 82: Extract Audio Cache Settings State

Status: done

Goal: Move audio cache directory/status/cleanup behavior out of `PlaybackSettingsPanel.vue`.

Scope:
- Introduce `useAudioCacheSettings.ts` for cache status, cache used label, directory selection, default/system temp directory selection, clear/prune actions, and refresh.
- Keep the settings panel template and player settings mutations intact.
- Preserve existing service calls and messages.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `useAudioCacheSettings.ts` for audio cache status, used label, directory selection, default/system temp selection, clear/prune actions, and refresh.
- Updated `PlaybackSettingsPanel.vue` to use the composable instead of calling dialog/backend cache services directly.
- Kept the settings panel template and player settings mutations unchanged.
- Verified with `npx vue-tsc --noEmit`.

### Step 83: Extract Audio Output Device Settings State

Status: done

Goal: Move output device loading and selection behavior out of `PlaybackSettingsPanel.vue`.

Scope:
- Introduce `useAudioOutputDevices.ts` for output device list loading, refresh, and selection handling.
- Keep the output device template in `PlaybackSettingsPanel.vue`.
- Preserve current backend service call and player setting mutation.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `useAudioOutputDevices.ts` for output device list loading, refresh, and select-event handling.
- Updated `PlaybackSettingsPanel.vue` to use the composable instead of calling the backend output-device service directly.
- Kept the output device template and player setting mutation behavior unchanged.
- Verified with `npx vue-tsc --noEmit`.

### Step 84: Audit PlaybackSettingsPanel UI Boundaries

Status: done

Goal: Decide whether another playback settings extraction is safe after moving service-backed state out.

Scope:
- Re-check `PlaybackSettingsPanel.vue` size and remaining responsibilities.
- Prefer extracting cohesive settings groups only if props/events remain simple.
- Avoid broad settings form rewrites.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `PlaybackSettingsPanel.vue` is now about 402 lines after moving cache and output-device service-backed state to composables.
- Remaining UI groups are playback transitions, cache fields, output device, sleep timer defaults/actions, quality fallback, and failure action.
- The smallest safe UI extraction is the playback transitions checkbox group because it only needs three booleans and three update events.
- Verified current state with `npx vue-tsc --noEmit`.

### Step 85: Extract Playback Transitions Settings Group

Status: done

Goal: Move the playback transition checkbox group out of `PlaybackSettingsPanel.vue`.

Scope:
- Introduce `PlaybackTransitionsSettings.vue` for seamless/fade/crossfade options.
- Keep player settings storage and mutations in `PlaybackSettingsPanel.vue`.
- Preserve labels and checkbox behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `PlaybackTransitionsSettings.vue` for seamless/fade/crossfade checkbox options.
- Replaced the inline playback transitions group in `PlaybackSettingsPanel.vue` with the new component.
- Moved transition-group scoped styles into the child component.
- Verified with `npx vue-tsc --noEmit`.

### Step 86: Final Playback Settings Verification

Status: done

Goal: Verify playback settings extractions and capture remaining risks.

Scope:
- Run type checking after playback settings changes.
- Inspect current `PlaybackSettingsPanel.vue` size and remaining responsibilities.
- Stop short of broad settings form rewrites unless the next group is clearly isolated.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Final verification passed with `npx vue-tsc --noEmit`.
- `PlaybackSettingsPanel.vue` is now about 382 lines, reduced from about 438 lines at the start of this pass.
- Extracted service-backed settings behavior: `useAudioCacheSettings.ts` and `useAudioOutputDevices.ts`.
- Extracted display-only transition options: `PlaybackTransitionsSettings.vue`.
- Remaining groups are cache fields, output device field, sleep timer defaults/actions, quality fallback, and playback failure action.
- Recommended next pass: inspect `SleepTimerControl.vue`, now the largest component, before further splitting settings UI.

### Step 87: Audit SleepTimerControl Split Boundary

Status: done

Goal: Find the smallest safe extraction inside `SleepTimerControl.vue`.

Scope:
- Inspect sleep timer state, actions, template sections, and style ownership.
- Prefer extracting display-only controls before touching timer behavior or persistence.
- Continue only if the boundary is clear and verifiable.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `SleepTimerControl.vue` is mostly UI: trigger button, active status popover, and setup dialog.
- Timer behavior and persistence already live in `useSleepTimer`.
- The smallest safe extraction is the active status popover because it only needs active labels/progress and pause/resume/clear/close events.

### Step 88: Extract Sleep Timer Status Popover

Status: done

Goal: Move the active sleep timer status popover out of `SleepTimerControl.vue`.

Scope:
- Introduce `SleepTimerStatusPopover.vue` for remaining time, progress bar, pause/resume, cancel, and close button.
- Keep trigger button and setup dialog in `SleepTimerControl.vue`.
- Preserve current props/events and styling.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `SleepTimerStatusPopover.vue` for the active timer status popover.
- Replaced the inline status popover in `SleepTimerControl.vue` with `SleepTimerStatusPopover`.
- Moved popover scoped styles into the child component.
- Verified with `npx vue-tsc --noEmit`.

### Step 89: Extract Sleep Timer Dialog

Status: done

Goal: Move the sleep timer setup dialog out of `SleepTimerControl.vue`.

Scope:
- Introduce `SleepTimerDialog.vue` for preset buttons, custom time inputs, action radio options, and footer actions.
- Keep trigger button and high-level control composition in `SleepTimerControl.vue`.
- Preserve all dialog props/events and styling.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added `SleepTimerDialog.vue` for sleep timer presets, custom time inputs, action radio options, and footer actions.
- Replaced the inline setup dialog in `SleepTimerControl.vue` with `SleepTimerDialog`.
- Moved dialog scoped styles and input handlers into the child component.
- Verified with `npx vue-tsc --noEmit`.

### Step 90: Final SleepTimerControl Verification

Status: done

Goal: Verify sleep timer control extractions and capture remaining risks.

Scope:
- Run type checking after sleep timer UI extraction.
- Inspect current `SleepTimerControl.vue` size and largest component ranking.
- Avoid changing timer behavior because it is already owned by `useSleepTimer`.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Final verification passed with `npx vue-tsc --noEmit`.
- `SleepTimerControl.vue` is now about 128 lines, reduced from about 437 lines at the start of this pass.
- Extracted sleep timer UI pieces: `SleepTimerStatusPopover.vue` and `SleepTimerDialog.vue`.
- Remaining `SleepTimerControl.vue` responsibility is trigger button plus child component composition.
- Timer behavior remains correctly owned by `useSleepTimer`.
- Recommended next pass: inspect `PlayerDock.vue`, `TrackMetadataDialog.vue`, and `McpSettingsPanel.vue`, which are now the largest remaining components.

### Step 91: Audit PlayerDock Split Boundary

Status: done

Goal: Find the smallest safe extraction inside `PlayerDock.vue`.

Scope:
- Inspect playback dock template, runtime composable wiring, and style ownership.
- Prefer extracting display-only controls or composed panels before touching playback runtime behavior.
- Continue only if the boundary is clear and verifiable.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `PlayerDock.vue` is already mostly an orchestration component for playback runtime, progress, queue, cover, and sleep timer wiring.
- Avoided moving runtime/progress/sleep/queue behavior in this pass because those boundaries carry higher playback regression risk.
- Selected the active-track download button inside `PlaybackMetaControls.vue` as the next small display-only extraction.

### Step 92: Extract Dock Download Button

Status: done

Goal: Move the active-track download button out of `PlaybackMetaControls.vue` so the meta controls component remains a composition layer.

Scope:
- Create a small player-dock download button component.
- Move only the button rendering and button-specific styles.
- Keep `PlaybackMetaControls.vue` responsible for when the button is shown and for forwarding the download event.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `DockDownloadButton.vue` for the active-track download icon/button state.
- Moved downloaded/downloading button-specific styles into the new component.
- Kept `PlaybackMetaControls.vue` responsible for visibility and event forwarding only.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 93: Audit MCP Settings Split Boundary

Status: done

Goal: Identify a low-risk extraction in `McpSettingsPanel.vue`.

Scope:
- Inspect MCP settings page responsibilities.
- Prefer moving an independent panel before changing settings persistence or static configuration text.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `McpSettingsPanel.vue` currently mixes auto-start setting, worker health refresh state, endpoint/config presentation, and feature list rendering.
- The MCP worker status panel is the cleanest next boundary because its loading/error/snapshot state is self-contained.
- Avoided changing MCP config JSON generation and feature text in this step.

### Step 94: Extract MCP Status Panel

Status: done

Goal: Move MCP worker health status UI and refresh state into a focused settings component.

Scope:
- Create `McpStatusPanel.vue` under settings components.
- Move health refresh state, status labels, and status panel styles into the new component.
- Keep `McpSettingsPanel.vue` responsible for the auto-start setting, endpoint constants, config JSON, and feature list.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `McpStatusPanel.vue` for MCP worker health loading/error/snapshot state.
- Moved status label derivation, restart policy formatting, refresh action, and status panel styles into the new component.
- Kept `McpSettingsPanel.vue` focused on settings page composition and static MCP configuration sections.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 95: Extract MCP Connection Config Panel

Status: done

Goal: Move MCP endpoint/config JSON display and copy feedback state into a focused settings component.

Scope:
- Create `McpConnectionPanel.vue` under settings components.
- Move endpoint constants, JSON generation, clipboard copy action, copy feedback state, and related styles into the new component.
- Keep `McpSettingsPanel.vue` responsible for auto-start setting, MCP service status composition, and feature list composition.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `McpConnectionPanel.vue` for endpoint/config JSON display and clipboard copy feedback state.
- Moved endpoint constants, MCP JSON generation, copy action, and connection/config styles into the new component.
- Reduced `McpSettingsPanel.vue` to about 187 lines and removed copied connection state from the parent page.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 96: Extract MCP Feature Grid

Status: done

Goal: Move MCP capability list rendering and card styles out of `McpSettingsPanel.vue`.

Scope:
- Create `McpFeatureGrid.vue` under settings components.
- Keep the feature data in `McpSettingsPanel.vue` for now to avoid changing static content ownership in the same step.
- Move only list/card rendering and feature-grid styles into the child component.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `McpFeatureGrid.vue` for MCP capability list/card rendering.
- Moved feature grid and card styles into the new child component.
- Kept feature data in `McpSettingsPanel.vue` to avoid changing static content ownership in the same step.
- Reduced `McpSettingsPanel.vue` to about 149 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 97: Audit Track Metadata Dialog Split Boundary

Status: done

Goal: Find the smallest safe extraction inside `TrackMetadataDialog.vue`.

Scope:
- Inspect metadata dialog form state, cover/audio loading, summary panel, editor fields, and footer actions.
- Prefer extracting display-only summary/editor sections before moving async metadata loading behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `TrackMetadataDialog.vue` currently combines form state, cover/audio info loading, summary rendering, editor fields, and footer actions.
- The left metadata summary is the smallest safe boundary because it only receives prepared labels/cover URL and emits a cover-error event.
- Avoided moving metadata save state or async audio/cover loading in this step.

### Step 98: Extract Track Metadata Summary

Status: done

Goal: Move the metadata dialog left summary panel into a focused component.

Scope:
- Create `TrackMetadataSummary.vue` under a `track-metadata` component folder.
- Move cover preview rendering, file info display, and summary-specific styles into the child component.
- Keep `TrackMetadataDialog.vue` responsible for async loading, computed labels, form state, and save/close actions.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `TrackMetadataSummary.vue` under `src/components/track-metadata`.
- Moved cover preview rendering, file info display, summary styles, and mobile cover sizing into the child component.
- Kept async cover/audio loading and computed file labels in `TrackMetadataDialog.vue`.
- Reduced `TrackMetadataDialog.vue` to about 335 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 99: Extract Track Metadata Editor

Status: done

Goal: Move the metadata input fields out of `TrackMetadataDialog.vue` without moving form state or save behavior.

Scope:
- Create `TrackMetadataEditor.vue` under `src/components/track-metadata`.
- Move title/album/artist/year/track-number/genre field rendering and field styles into the child component.
- Keep the parent dialog responsible for refs, submit validation, save payload, and async metadata loading.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `TrackMetadataEditor.vue` under `src/components/track-metadata`.
- Moved metadata input field rendering and field input styles into the child component.
- Kept form refs, submit validation, save payload, and async metadata loading in `TrackMetadataDialog.vue`.
- Reduced `TrackMetadataDialog.vue` to about 288 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 100: Extract Track Metadata Format Helpers

Status: done

Goal: Move pure metadata label formatting out of `TrackMetadataDialog.vue`.

Scope:
- Create a small utility module for metadata date, sample rate, channel, and file size labels.
- Keep async audio info loading and dialog state inside `TrackMetadataDialog.vue`.
- Avoid changing user-facing formatting behavior beyond making the helpers reusable.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Added metadata label helpers to `src/utils/format.ts` for date, sample rate, channels, and file size formatting.
- Updated `TrackMetadataDialog.vue` to import the pure helpers and pass locale explicitly to date formatting.
- Reduced `TrackMetadataDialog.vue` to about 250 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 101: Re-scan Remaining Large Components

Status: done

Goal: Pick the next low-risk architecture cleanup after the metadata dialog pass.

Scope:
- Recount remaining large Vue components.
- Inspect candidates for display-only extraction before touching runtime, table interaction, or async service logic.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Recounted remaining Vue components after the MCP and metadata dialog passes.
- Largest remaining UI-heavy components include `PluginTable.vue`, `PluginMarketDetailPanel.vue`, `PluginMarketMain.vue`, `PlaybackSettingsPanel.vue`, `TrackTable.vue`, `LyricsView.vue`, and `PlayerDock.vue`.
- Selected `PluginTable.vue` row action buttons as the next safe display/action extraction because they are localized to a single table cell and only forward events.

### Step 102: Extract Plugin Row Actions

Status: done

Goal: Move plugin install/update/toggle/remove row actions out of `PluginTable.vue`.

Scope:
- Create `PluginRowActions.vue` under plugin-manager components.
- Move action button rendering, icons, and action-specific styles into the child component.
- Keep `PluginTable.vue` responsible for table structure, selection, drag behavior, and event forwarding.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PluginRowActions.vue` under plugin-manager components.
- Moved install/update/toggle/remove row action rendering, icons, and action-specific styles into the child component.
- Kept `PluginTable.vue` responsible for table structure, selection, drag behavior, and event forwarding.
- Reduced `PluginTable.vue` to about 296 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 103: Audit Plugin Market Detail Boundary

Status: done

Goal: Find the next low-risk extraction in plugin market detail UI.

Scope:
- Inspect `PluginMarketDetailPanel.vue` responsibilities and style ownership.
- Prefer extracting static/detail display sections before touching install/update subscription behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `PluginMarketDetailPanel.vue` mixes detail heading, primary install/update action, description/capability/permission/highlight/meta display, and screenshot carousel.
- Selected the primary detail action button as the smallest safe extraction because it only derives disabled/icon/loading state and emits the existing action event.
- Avoided moving screenshot carousel and permission sections in the first detail pass.

### Step 104: Extract Plugin Detail Primary Action

Status: done

Goal: Move plugin detail install/update/installed action button out of `PluginMarketDetailPanel.vue`.

Scope:
- Create `PluginDetailPrimaryAction.vue` under plugin-manager components.
- Move action button icon rendering, disabled/loading logic, and button-specific styles into the child component.
- Keep `PluginMarketDetailPanel.vue` responsible for detail layout and action forwarding.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PluginDetailPrimaryAction.vue` for the detail install/update/installed button.
- Moved action icon selection, disabled/loading state, spin animation, and button-specific styles into the child component.
- Kept `PluginMarketDetailPanel.vue` responsible for detail layout and event forwarding.
- Reduced `PluginMarketDetailPanel.vue` to about 355 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 105: Extract Plugin Detail Screenshots

Status: done

Goal: Move plugin detail screenshot carousel rendering out of `PluginMarketDetailPanel.vue`.

Scope:
- Create `PluginDetailScreenshots.vue` under plugin-manager components.
- Move screenshot frame, previous/next buttons, dot navigation, and screenshot-specific styles into the child component.
- Keep screenshot state and navigation handlers owned by the current detail panel caller.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PluginDetailScreenshots.vue` for the screenshot frame, previous/next controls, dot navigation, and screenshot styles.
- Kept screenshot state and navigation handlers outside the child, with the detail panel only forwarding events.
- Reduced `PluginMarketDetailPanel.vue` to about 268 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 106: Extract Plugin Detail Heading

Status: done

Goal: Move plugin detail heading/icon rendering out of `PluginMarketDetailPanel.vue`.

Scope:
- Create `PluginDetailHeading.vue` under plugin-manager components.
- Move plugin kind icon selection, title/meta rendering, and heading/icon styles into the child component.
- Keep `PluginMarketDetailPanel.vue` responsible for section composition and action forwarding.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PluginDetailHeading.vue` for plugin kind icon selection, title, and author/type/runtime metadata.
- Moved heading and icon styles into the child component.
- Reduced `PluginMarketDetailPanel.vue` to about 196 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 107: Audit Plugin Market Main Boundary

Status: done

Goal: Find the next low-risk extraction in `PluginMarketMain.vue`.

Scope:
- Inspect market search, filters, loading/empty states, and plugin card rendering.
- Prefer extracting repeated plugin card rendering before touching filter/search state contracts.

Verify:
- `npx vue-tsc --noEmit`

Result:
- `PluginMarketMain.vue` mixes search, status filters, loading/empty states, repeated plugin card rendering, and card action button state.
- Selected the repeated plugin market card as the next safe extraction because it only receives prepared labels/state and emits select/action.
- Kept search and filter state contracts in the parent list component.

### Step 108: Extract Plugin Market Card

Status: done

Goal: Move repeated plugin market card rendering out of `PluginMarketMain.vue`.

Scope:
- Create `PluginMarketCard.vue` under plugin-manager components.
- Move card icon selection, title/meta/description/tags, status badge, action button, and card-specific styles into the child component.
- Keep `PluginMarketMain.vue` responsible for search, filters, loading/empty states, and list iteration.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PluginMarketCard.vue` for repeated market plugin card rendering.
- Moved card icon selection, status badge, metadata/tags display, action button, card responsive rules, and card-specific styles into the child component.
- Kept `PluginMarketMain.vue` responsible for search, filters, loading/empty states, and list iteration.
- Reduced `PluginMarketMain.vue` to about 181 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 109: Next Architecture Candidates

Status: done

Goal: Select the next useful cleanup pass without over-refactoring.

Scope:
- Revisit the largest remaining components after the plugin market pass.
- Prefer components with clear display/state boundaries such as playback settings panels, local theme grid, desktop lyrics, or remaining table cells.
- Treat `App.vue`, `PlayerDock.vue`, and `TrackTable.vue` cautiously because they still carry broad orchestration or interaction behavior.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Re-scanned remaining large Vue components after the plugin market pass.
- `PlaybackSettingsPanel.vue` is the next best candidate because cache settings, output device settings, sleep timer defaults, fallback options, and transition settings still share one settings component.
- Selected audio cache settings as the next safe extraction because cache state already has a dedicated composable and can move next to its UI.

### Step 110: Extract Playback Audio Cache Settings

Status: done

Goal: Move playback audio cache UI/state out of `PlaybackSettingsPanel.vue`.

Scope:
- Create `PlaybackAudioCacheSettings.vue` under settings components.
- Move `useAudioCacheSettings` usage, cache directory controls, cache max input, cache cleanup actions, and cache-specific styles into the child component.
- Keep `PlaybackSettingsPanel.vue` responsible for composing playback settings sections.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PlaybackAudioCacheSettings.vue` for audio cache directory and cache management UI/state.
- Moved `useAudioCacheSettings`, cache status refresh, cache directory actions, max-size input, cleanup action, and cache-specific styles into the child component.
- Kept `PlaybackSettingsPanel.vue` focused on composing playback settings sections.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 111: Extract Playback Audio Output Settings

Status: done

Goal: Move playback output-device UI/state out of `PlaybackSettingsPanel.vue`.

Scope:
- Create `PlaybackAudioOutputSettings.vue` under settings components.
- Move `useAudioOutputDevices` usage, device refresh lifecycle, output select, refresh button, and output-specific styles into the child component.
- Keep `PlaybackSettingsPanel.vue` responsible for composing playback settings sections.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PlaybackAudioOutputSettings.vue` for output device selection and refresh UI/state.
- Moved `useAudioOutputDevices`, device refresh lifecycle, output select, refresh button, and output-specific styles into the child component.
- Reduced `PlaybackSettingsPanel.vue` to about 217 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 112: Extract Playback Sleep Timer Defaults

Status: done

Goal: Move sleep-timer default playback settings out of `PlaybackSettingsPanel.vue`.

Scope:
- Create `PlaybackSleepTimerSettings.vue` under settings components.
- Move default minutes input, timer action radio group, and number-field styles into the child component.
- Keep `PlaybackSettingsPanel.vue` responsible for composing playback settings sections and fallback options.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PlaybackSleepTimerSettings.vue` for default timer minutes and timer-completion action.
- Moved timer input handling, action radio group, and number-field styles into the child component.
- Reduced `PlaybackSettingsPanel.vue` to about 140 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 113: Extract Playback Fallback Settings

Status: done

Goal: Move quality and playback-failure fallback options out of `PlaybackSettingsPanel.vue`.

Scope:
- Create `PlaybackFallbackSettings.vue` under settings components.
- Move fallback option constants, radio groups, and option-group styles into the child component.
- Leave `PlaybackSettingsPanel.vue` as a thin composition component for playback setting sections.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `PlaybackFallbackSettings.vue` for quality fallback and online playback failure behavior options.
- Moved fallback option constants, radio-group rendering, and option-group styles into the child component.
- Reduced `PlaybackSettingsPanel.vue` to about 74 lines, leaving it as a thin playback settings composition component.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 114: Re-scan Post Playback Settings Extraction

Status: done

Goal: Pick the next safe component boundary after playback settings was reduced to composition.

Scope:
- Recount large remaining components.
- Inspect components with clear display/state sections before touching broad app orchestration.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Re-scanned remaining large components after reducing playback settings.
- `GeneralSettingsPanel.vue` is a good next candidate because it still mixes general app preferences, track-list options, language selection, and download directory dialog behavior.
- Selected the download directory setting as the next safe extraction because it owns a specific dialog action and path input UI.

### Step 115: Extract General Download Directory Setting

Status: done

Goal: Move download directory selection out of `GeneralSettingsPanel.vue`.

Scope:
- Create `GeneralDownloadDirectorySetting.vue` under settings components.
- Move Tauri directory picker usage, download path input, choose button, and path-field styles into the child component.
- Keep `GeneralSettingsPanel.vue` responsible for general preference groups and language/history/table options.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `GeneralDownloadDirectorySetting.vue` for download path input and directory picker behavior.
- Moved Tauri `open` usage, choose-directory action, path input, choose button, and path-field styles into the child component.
- Reduced `GeneralSettingsPanel.vue` to about 222 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 116: Extract General Track List Settings

Status: done

Goal: Move song-list display and context-menu toggles out of `GeneralSettingsPanel.vue`.

Scope:
- Create `GeneralTrackListSettings.vue` under settings components.
- Move track number/cover visibility toggles and track context-menu option toggles into the child component.
- Keep close behavior, history limit, language, and download directory composition in the parent for now.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `GeneralTrackListSettings.vue` for song-list column visibility and track context-menu toggles.
- Moved checkbox rendering and track-list option styles into the child component.
- Reduced `GeneralSettingsPanel.vue` to about 186 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 117: Extract General Behavior Settings

Status: done

Goal: Move close behavior and search-history limit options out of `GeneralSettingsPanel.vue`.

Scope:
- Create `GeneralBehaviorSettings.vue` under settings components.
- Move close action radio group, search history option constants, history limit radio group, and related option styles into the child component.
- Keep language and download directory composition in the parent for now.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `GeneralBehaviorSettings.vue` for close behavior and search-history limit options.
- Moved history option constants, radio groups, event parsing, and option styles into the child component.
- Reduced `GeneralSettingsPanel.vue` to about 115 lines.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 118: Extract General Language Setting

Status: done

Goal: Move language selection out of `GeneralSettingsPanel.vue`.

Scope:
- Create `GeneralLanguageSetting.vue` under settings components.
- Move locale select rendering, locale event parsing, and select styles into the child component.
- Leave `GeneralSettingsPanel.vue` as a thin composition component for general settings sections.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Created `GeneralLanguageSetting.vue` for locale selection.
- Moved locale event parsing and select styles into the child component.
- Reduced `GeneralSettingsPanel.vue` to about 65 lines, leaving it as a thin composition component for general settings sections.
- Verification passed: `npx vue-tsc --noEmit`.

### Step 119: Next General Frontend Candidates

Status: pending

Goal: Continue with the next high-signal cleanup without disturbing broad orchestration.

Scope:
- Re-scan remaining large components such as `SidebarNav.vue`, `LocalThemeGrid.vue`, `DesktopLyrics.vue`, `TrackCoverThumb.vue`, and remaining table/player orchestration components.
- Prefer extracting repeated display cards, pure panels, and component-owned state before touching app-level runtime or route/page orchestration.

Verify:
- `npx vue-tsc --noEmit`

Result:
- Pending.

## Execution Log

### 2026-07-27

- Created this execution plan.
- Completed Step 1: stabilized `AppLayout` by fixing the broken resize handle accessibility label and passing Vue type checking.
- Completed Step 2: moved discover/online search state out of `App.vue` into `DiscoverMusicPage.vue`, keeping only a playback-facing search snapshot in the parent.
- Completed Step 3: extracted download flow commands and backend download events into `useDownloadController` while preserving playback and playlist boundaries in `App.vue`.
- Completed Step 4: extracted `PlayerDock.vue` Rust playback runtime behavior into `usePlayerDockRuntime` and kept the dock focused on UI wiring.
- Completed Step 5: split plugin manager selection and drag sorting use cases into focused composables without changing catalog, install, or subscription behavior.
- Added Phase 2 plan for plugin market, plugin subscriptions, and thinner page dispatch.
- Completed Step 6: extracted plugin marketplace state and derived UI data into `usePluginMarket`.
- Completed Step 7: extracted plugin subscription state and service flow into `usePluginSubscriptions`.
- Completed Step 8: extracted the local library page branch from `AppMainContent.vue` into `LibraryHomePage.vue`.
- Added Step 9 for plugin install action extraction.
- Completed Step 9: extracted plugin install actions and plugin theme side effects into `usePluginInstallActions`.
- Completed Step 10: extracted application startup orchestration into `useAppBootstrap`.
- Completed Step 11: extracted app-level event listener registration and cleanup into `useAppEventListeners`.
- Completed Step 12: extracted system media metadata sync from `App.vue` into `useSystemMediaSync`.
- Completed Step 13: extracted desktop lyrics state broadcast/open-window behavior from `App.vue` into `useDesktopLyricsSync`.
- Completed Step 14: extracted queue source identity helpers from `App.vue` into `src/utils/queueSource.ts`.
- Completed Step 15: extracted local-library-driven Rust queue pruning from `App.vue` into `useLocalLibraryQueuePruning`.
- Completed Step 16: removed duplicate queue source helper from `usePlayerDockRuntime.ts` and reused `src/utils/queueSource.ts`.
- Completed Step 17: extracted per-track playback lyric format selection state from `App.vue` into `usePlaybackLyricFormat`.
- Completed Step 18: extracted menu availability guard watchers from `App.vue` into `useNavigationAvailabilityGuards`.
- Completed Step 19: moved active-track lyrics view status auto-sync into `useLyricsState`.
- Completed Step 20: extracted player error-to-toast bridging into `usePlayerErrorToast` and moved toast timer cleanup into `useOnlineToast`.
- Completed Step 21: extracted local library derived view data from `App.vue` into `useLibraryCatalog`, leaving artist grouping for a later navigation-focused step.
- Completed Step 22: moved artist grouping into `useLibraryCatalog` and loosened `useLibraryNavigation` to use a default-artist callback.
- Completed Step 23: extracted local lyrics request/cache/background-loading state from `App.vue` into `useLocalLyricsLoader`.
- Completed Step 24: extracted pure playback helper functions from `App.vue` into `src/utils/playback.ts`.
- Completed Step 25: extracted online lyrics request de-duplication and background loading from `App.vue` into `useOnlineLyricsLoader`.
- Completed Step 26: extracted top-window drag behavior from `App.vue` into `useWindowDrag`.
- Completed Step 27: extracted MCP sleep timer request bridging from `App.vue` into `useMcpSleepTimerRequest`.
- Completed Step 28: extracted downloaded-track conversion and matching helpers from `App.vue` into `src/utils/downloadedTrack.ts`.
- Completed Step 29: extracted track runtime metadata merge and identity helpers from `App.vue` into `src/utils/trackRuntimeMetadata.ts`.
- Completed Step 30: extracted online search snapshot and error state from `App.vue` into `useOnlineSearchSnapshotBridge`.
- Completed Step 31: extracted lyrics panel visibility state from `App.vue` into `useLyricsViewVisibility`.
- Completed Step 32: extracted downloaded-track UI actions from `App.vue` into `useDownloadedTrackActions`.
- Completed Step 33: extracted favorite-track actions from `App.vue` into `useFavoriteTrackActions`.
- Completed Step 34: extracted active-track lyrics mutation actions from `App.vue` into `useTrackLyricsMutation`.
- Completed Step 35: extracted small Rust queue command actions from `App.vue` into `useRustQueueCommands`.
- Completed Step 36: extracted online playback lookup and queue-building helpers from `App.vue` into `useOnlinePlaybackLookup`.
- Completed Step 37: extracted online playback start, failure fallback, and quality switching from `App.vue` into `useOnlinePlaybackController`.
- Completed Step 38: extracted content-area navigation actions and online-search cleanup from `App.vue` into `useContentNavigationActions`.
- Completed Step 39: extracted local playback list and queue actions from `App.vue` into `useLocalPlaybackActions`.
- Completed Step 40: extracted downloaded online playback source mapping and plugin fallback retry from `App.vue` into `useDownloadedOnlinePlaybackFallback`.
- Completed Step 41: extracted playback lyric format switching and local lyric application from `App.vue` into `usePlaybackLyricsActions`.
- Completed Step 42: extracted tray, desktop lyrics, and system media command dispatch from `App.vue` into `useExternalPlaybackActions`.
- Completed Step 43: extracted simple track selection and online context-menu actions from `App.vue` into `useTrackInteractionActions`.
- Completed Step 44: extracted Rust previous/next transport commands and playback-failure fallback handling from `App.vue` into `useRustPlaybackTransport`.
- Completed Step 45: extracted active-track playback start and lyric seek behavior from `App.vue` into `useActivePlaybackSeekActions`.
- Completed Step 46: extracted Rust queue snapshot current-track lookup from `App.vue` into `src/utils/rustQueueSnapshot.ts`.
- Completed Step 47: extracted Rust playback start/restore lifecycle implementation from `App.vue` into `useRustPlaybackLifecycle`.
- Completed Step 48: extracted Rust queue snapshot reconciliation and seamless-advance state transitions from `App.vue` into `useRustQueueSnapshotController`.
- Completed Step 49: moved preparing playback cleanup ownership into `useActiveTrackState`.
- Completed Step 50: extracted active-track display and context permission computed state from `App.vue` into `useActiveTrackUiState`.
- Completed Step 51: internalized playback lyric action context registration and removed the remaining lyric-format bridge functions from `App.vue`.
- Completed Step 52: extracted sleep-timer-triggered save-and-exit behavior from `App.vue` into `useSleepTimerExitAction`.
- Completed Step 53: removed the template-only seamless advance wrapper from `App.vue`.
- Completed Step 54: extracted plugin center tab state and visible plugin row derivation from `PluginManagerView.vue`.
- Completed Step 55: extracted plugin catalog state and loading helpers from `PluginManagerView.vue`.
- Completed Step 56: extracted the installed plugins panel into `PluginInstalledPanel.vue`, moved its scoped layout style, and passed `npx vue-tsc --noEmit`.
- Completed Step 57: extracted the subscriptions panel into `PluginSubscriptionsPanel.vue`, moved its scoped styles, and passed `npx vue-tsc --noEmit`.
- Completed Step 58: extracted the plugin market category sidebar into `PluginMarketSidebar.vue`, moved its responsive styles, and passed `npx vue-tsc --noEmit`.
- Completed Step 59: extracted the plugin market main list into `PluginMarketMain.vue`, moved its scoped styles, and passed `npx vue-tsc --noEmit`.
- Completed Step 60: extracted the plugin market detail panel into `PluginMarketDetailPanel.vue`, moved its scoped styles, and passed `npx vue-tsc --noEmit`.
- Completed Step 61: extracted the plugin market shell composition into `PluginMarketPanel.vue`, moved its responsive layout styles, and passed `npx vue-tsc --noEmit`.
- Completed Step 62: removed `AppLayout.vue` child class deep selectors by adding an explicit layout content wrapper, and passed `npx vue-tsc --noEmit`.
- Completed Step 63: audited `AppMainContent.vue` and identified `AppPageOutlet.vue` extraction as the next safe page-dispatch refactor.
- Completed Step 64: extracted page dispatch into `AppPageOutlet.vue`, kept `AppMainContent.vue` focused on layout/sidebar composition, and passed `npx vue-tsc --noEmit`.
- Completed Step 65: re-scanned frontend component sizes and deep selector usage, identifying plugin center tab styling as the next small cleanup.
- Completed Step 66: moved plugin center tab styles into `SegmentTabs.vue`, removed `PluginManagerView.vue` deep tab selectors, and passed `npx vue-tsc --noEmit`.
- Completed Step 67: ran final verification, captured remaining architecture risks, and passed `npx vue-tsc --noEmit`.
- Completed Step 68: audited `TrackTable.vue` and selected row actions as the smallest safe extraction.
- Completed Step 69: extracted favorite/download row action buttons into `TrackRowActions.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 70: extracted the table header into `TrackTableHeader.vue`, kept grid sizing in `TrackTable.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 71: extracted the row title/cover cell into `TrackTitleCell.vue`, kept row behavior in `TrackTable.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 72: audited `TrackTable.vue` after display extractions and selected the artist cell as the next safe boundary.
- Completed Step 73: extracted artist cell rendering/link behavior into `TrackArtistCell.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 74: verified the table display extractions, reduced `TrackTable.vue` to about 413 lines, and passed `npx vue-tsc --noEmit`.
- Completed Step 75: audited `LyricsView.vue` and selected the center lyrics stage as the next safe extraction.
- Completed Step 76: extracted the lyrics center stage into `lyrics/LyricsStage.vue`, removed `LyricsView.vue` stage deep selectors, and passed `npx vue-tsc --noEmit`.
- Completed Step 77: audited `LyricsView.vue` after stage extraction and selected the action menu overlay as the next safe boundary.
- Completed Step 78: extracted the lyrics action menu Teleport into `lyrics/LyricsActionMenuOverlay.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 79: extracted the lyrics search dialog Teleport into `lyrics/LyricsSearchDialogOverlay.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 80: verified the lyrics view extractions, captured remaining orchestration risks, and passed `npx vue-tsc --noEmit`.
- Completed Step 81: audited the next largest components and selected audio cache settings state as the next safe extraction.
- Completed Step 82: extracted audio cache settings behavior into `useAudioCacheSettings.ts` and passed `npx vue-tsc --noEmit`.
- Completed Step 83: extracted audio output device state into `useAudioOutputDevices.ts` and passed `npx vue-tsc --noEmit`.
- Completed Step 84: audited `PlaybackSettingsPanel.vue` UI groups and selected playback transitions as the next safe extraction.
- Completed Step 85: extracted playback transition checkbox UI into `PlaybackTransitionsSettings.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 86: verified playback settings extractions, reduced `PlaybackSettingsPanel.vue` to about 382 lines, and passed `npx vue-tsc --noEmit`.
- Completed Step 87: audited `SleepTimerControl.vue` and selected the active status popover as the next safe extraction.
- Completed Step 88: extracted active sleep timer status popover into `SleepTimerStatusPopover.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 89: extracted the sleep timer setup dialog into `SleepTimerDialog.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 90: verified sleep timer UI extractions, reduced `SleepTimerControl.vue` to about 128 lines, and passed `npx vue-tsc --noEmit`.
- Completed Step 91: audited the player dock split boundary and selected the display-only active-track download button as the next safe extraction.
- Completed Step 92: extracted the dock active-track download button into `DockDownloadButton.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 93: audited MCP settings and selected the self-contained worker status panel as the next safe extraction.
- Completed Step 94: extracted MCP worker health UI/state into `McpStatusPanel.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 95: extracted MCP endpoint/config JSON display and copy feedback into `McpConnectionPanel.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 96: extracted MCP capability list rendering into `McpFeatureGrid.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 97: audited the track metadata dialog and selected the left summary panel as the next safe extraction.
- Completed Step 98: extracted the track metadata summary panel into `TrackMetadataSummary.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 99: extracted the track metadata editor fields into `TrackMetadataEditor.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 100: moved track metadata formatting helpers into `src/utils/format.ts` and passed `npx vue-tsc --noEmit`.
- Completed Step 101: re-scanned remaining large components and selected `PluginTable.vue` row actions as the next safe extraction.
- Completed Step 102: extracted plugin table row action buttons into `PluginRowActions.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 103: audited plugin market detail and selected the primary action button as the next safe extraction.
- Completed Step 104: extracted plugin detail primary action button into `PluginDetailPrimaryAction.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 105: extracted plugin detail screenshot carousel into `PluginDetailScreenshots.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 106: extracted plugin detail heading into `PluginDetailHeading.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 107: audited plugin market main list and selected the repeated plugin card as the next safe extraction.
- Completed Step 108: extracted repeated plugin market card rendering into `PluginMarketCard.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 109: re-scanned remaining large components and selected playback audio cache settings as the next safe extraction.
- Completed Step 110: extracted playback audio cache settings into `PlaybackAudioCacheSettings.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 111: extracted playback output device settings into `PlaybackAudioOutputSettings.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 112: extracted playback sleep timer defaults into `PlaybackSleepTimerSettings.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 113: extracted playback fallback option groups into `PlaybackFallbackSettings.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 114: re-scanned remaining large components and selected the general download directory setting as the next safe extraction.
- Completed Step 115: extracted general download directory setting into `GeneralDownloadDirectorySetting.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 116: extracted general track-list display/context settings into `GeneralTrackListSettings.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 117: extracted general close/search-history behavior settings into `GeneralBehaviorSettings.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 118: extracted general language selection into `GeneralLanguageSetting.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 119: extracted the theme import card into `ThemeImportCard.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 120: extracted built-in theme card rendering and preview tone styles into `ThemeBuiltInCard.vue` and passed `npx vue-tsc --noEmit`.
- Completed Step 121: extracted custom theme card rendering, keyboard/delete behavior, and scoped preview styles into `ThemeCustomCard.vue`; `LocalThemeGrid.vue` is now a grid composition component, and `npx vue-tsc --noEmit` passed.
- Completed Step 122: re-scanned remaining large frontend components and selected `TrackCoverThumb.vue` playback spectrum/equalizer display as the next small extraction boundary.
- Completed Step 123: extracted cover equalizer rendering, spectrum bar calculation, debug throttling, and loading animation styles into `TrackCoverEqualizer.vue`; `TrackCoverThumb.vue` now focuses on cover loading/cache/error fallback, and `npx vue-tsc --noEmit` passed.
- Completed Step 124: re-scanned remaining large frontend components after the cover split and selected `SidebarNav.vue` playlist navigation as the next surgical extraction because its scroll state and repeated playlist rows are self-contained.
- Completed Step 125: extracted the sidebar playlist navigation list into `SidebarPlaylistNavList.vue`, moved its private scrolling/item styles, removed the orphan parent selector, and passed `npx vue-tsc --noEmit`.
- Completed Step 126: audited `ArtistsView.vue` and selected the artist list panel as the next surgical extraction because it owns selected-row refs, scroll state, empty state, and row styling independently of the track table detail area.
- Completed Step 127: extracted the artist list panel into `artists/ArtistListPanel.vue`, moved selected-row scrolling and private list styles into it, and passed `npx vue-tsc --noEmit`.
- Completed Step 128: re-scanned remaining large components and selected `FolderCover.vue` cover loading/cache state as the next narrow extraction because it is independent from the cover rendering template.
- Completed Step 129: extracted folder cover URL loading, request de-duplication, cache trimming, HMR cleanup, and image error fallback into `useFolderCoverUrls.ts`; `FolderCover.vue` now renders from composable state, and `npx vue-tsc --noEmit` passed.
- Completed Step 130: removed obsolete `FolderCover.vue` cover button/image styles, kept the external `.cover-mini.folder-cover` sizing rule, reduced `FolderCover.vue` to about 120 lines, and passed `npx vue-tsc --noEmit`.
- Completed Step 131: re-scanned the remaining large components and selected `PluginSearchView.vue` search/provider header as the next focused refactor target because it owns local input state and tab derivation independently from result rendering.
- Completed Step 132: extracted plugin search header controls into `plugin-search/PluginSearchToolbar.vue`, moved private search text state/provider tab derivation/top styles into it, reduced `PluginSearchView.vue` to about 263 lines, and passed `npx vue-tsc --noEmit`.
- Completed Step 133: re-scanned remaining large components and selected `DesktopLyrics.vue` control bar as the next low-risk extraction because it is pure button/title rendering and event forwarding.
- Completed Step 134: extracted the desktop lyrics control bar into `desktop-lyrics/DesktopLyricsControls.vue`, moved private control styles there, replaced parent deep hover styling with an explicit hover prop, and passed `npx vue-tsc --noEmit`.
- Completed Step 135: re-scanned remaining large components and selected `lyrics/LyricsPanel.vue` sync controls as the next focused extraction because the timing buttons are local display/event-forwarding UI.
- Completed Step 136: extracted lyrics sync timing controls into `lyrics/LyricsSyncControls.vue`, moved private button styles there, reduced `LyricsPanel.vue` to about 265 lines, and passed `npx vue-tsc --noEmit`.
- Completed Step 137: re-scanned remaining large components and selected `PluginSearchView.vue` results list as the next small extraction because it owns result scrolling, loading states, and plugin-track table mapping.
- Completed Step 138: extracted plugin search results list into `plugin-search/PluginSearchResultsList.vue`, moved local scroll state/result table mapping/loading-more styles into it, reduced `PluginSearchView.vue` to about 90 lines, and passed `npx vue-tsc --noEmit`.
- Completed Step 139: re-scanned remaining large components and selected `WorkspaceView.vue` collection display derivation as the next focused extraction because the computed title/subtitle/date/empty/playability state is page-local but separable from layout.
- Completed Step 140: extracted workspace collection title/subtitle/date/empty/playability computed state into `useWorkspaceCollectionDisplay.ts`, kept `WorkspaceView.vue` responsible for layout/table refs/scroll events, and passed `npx vue-tsc --noEmit`.
- Completed Step 141: re-scanned remaining large components and selected `plugin-manager/PluginTable.vue` row rendering as the next small extraction because repeated plugin rows own selection, drag-handle, badge, capability, and action-cell markup.
- Completed Step 142: extracted plugin table row rendering into `plugin-manager/PluginTableRow.vue`, moved row selection/drag-handle/badge/capability/action styles there, reduced `PluginTable.vue` to about 182 lines, and passed `npx vue-tsc --noEmit`.
- Completed Step 143: extracted the top static navigation links into `sidebar/SidebarMainNavLinks.vue`, moved their private active/collapsed/link styles with the component, kept `SidebarNav.vue` as sidebar section composition, and passed `npx vue-tsc --noEmit`.
- Completed Step 144: extracted the playlist create divider/button into `sidebar/SidebarPlaylistCreateControl.vue`, moved its divider/button/collapsed styles into the component, and passed `npx vue-tsc --noEmit`.
- Completed Step 145: extracted the favorites navigation item into `sidebar/SidebarFavoritesNavLink.vue`, moved its active/collapsed/link text styles into the component, reduced `SidebarNav.vue` to sidebar section wiring, and passed `npx vue-tsc --noEmit`.
- Completed Step 146: removed unused `WorkspaceView.vue` public props/events (`useTrackCover`, `chooseFolder`, `rescan`), cleaned the now-noop parent bindings in `AppPageOutlet.vue` and `LibraryHomePage.vue`, verified the real scan entry remains on `LibraryPanel`, and passed `npx vue-tsc --noEmit`.
- Completed Step 147: removed orphan scoped selectors from `WorkspaceView.vue` (`.icon-button.muted` and dark `.play-button`), reducing stale parent-page styling assumptions, and passed `npx vue-tsc --noEmit`.
- Completed Step 148: extracted lyric line rendering into `lyrics/LyricsLine.vue`, moved line seek behavior, active/nearby state styles, and word-progress highlighting into the repeated line component, and passed `npx vue-tsc --noEmit`.
- Completed Step 149: extracted `PlayerDock.vue` playback error/notice state into `usePlaybackNotifications.ts`, moved timeout cleanup and locale-specific output-device fallback copy outside the dock composition component, and passed `npx vue-tsc --noEmit`.
- Completed Step 150: fixed `PlayerDock.vue` sleep timer stop wiring so `useSleepTimer` calls the current runtime stop function instead of the initial no-op placeholder, preserving timed stop behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 151: moved `PlayerDock.vue` playback-rate, online-quality, and lyric-format label derivation into `usePlayerDockLabels.ts`, keeping display formatting separate from dock orchestration, and passed `npx vue-tsc --noEmit`.
- Completed Step 152: extracted `PlayerDock.vue` transport request helpers into `usePlayerDockTransportRequests.ts`, moved previous-track throttling out of the dock composition component, and passed `npx vue-tsc --noEmit`.
- Completed Step 153: extracted `TrackTable.vue` paging, row refs, and scroll-to-track behavior into `useTrackTablePaging.ts`, kept table rendering and row state decisions in the component, and passed `npx vue-tsc --noEmit`.
- Completed Step 154: extracted `TrackTable.vue` row favorite/download state helpers into `useTrackTableRowState.ts`, kept action availability and labels in a table-specific composable, and passed `npx vue-tsc --noEmit`.
- Completed Step 155: extracted `TrackTable.vue` row interaction handlers into `useTrackTableInteractions.ts`, moved click/double-click/context-menu/artist-open event wiring out of the display component, and passed `npx vue-tsc --noEmit`.
- Completed Step 156: extracted `TrackTable.vue` CSS variable derivation into `useTrackTableStyle.ts`, kept table layout style calculation out of the component body, and passed `npx vue-tsc --noEmit`.
- Completed Step 157: extracted `LyricsView.vue` active lyrics, empty-message, associated-lyrics, active artwork, and downloadable-format derivation into `useLyricsMetadataState.ts`, and passed `npx vue-tsc --noEmit`.
- Completed Step 158: extracted `LyricsView.vue` CSS variable derivation into `useLyricsViewStyle.ts`, kept lyric font/color/background style state outside the view composition body, and passed `npx vue-tsc --noEmit`.
- Completed Step 159: extracted `LyricsView.vue` close/context-menu/mount cleanup behavior into `useLyricsViewInteractions.ts`, kept view-level interaction lifecycle outside the component body, and passed `npx vue-tsc --noEmit`.
- Completed Step 160: moved `LyricsView.vue` player-dock toggle behavior into `useLyricsViewInteractions.ts`, kept another view-level command out of the component body, and passed `npx vue-tsc --noEmit`.
- Completed Step 161: extracted `TrackTable.vue` active-row key matching into `useTrackTableActiveRow.ts`, kept selected/playing row identity logic outside the table display component, and passed `npx vue-tsc --noEmit`.
- Completed Step 162: extracted `LyricsView.vue` header/stage display labels into `useLyricsViewLabels.ts`, kept track fallback text and translated labels outside the template, and passed `npx vue-tsc --noEmit`.
- Completed Step 163: extracted `PluginManagerView.vue` notification variant mapping and installed capability formatting into `usePluginManagerPresentation.ts`, kept page presentation helpers out of the component body, verified Chinese copy, and passed `npx vue-tsc --noEmit`.
- Completed Step 164: extracted `PluginManagerView.vue` mount/unmount loading and cleanup sequence into `usePluginManagerLifecycle.ts`, kept lifecycle orchestration out of the page component body, and passed `npx vue-tsc --noEmit`.
- Completed Step 165: extracted `PlayerDock.vue` seek/sleep-timer watchers and cleanup into `usePlayerDockLifecycle.ts`, kept runtime lifecycle wiring out of the dock component body, and passed `npx vue-tsc --noEmit`.
- Completed Step 166: extracted `TrackTable.vue` header/action label derivation into `useTrackTableLabels.ts`, kept locale fallback rules outside the table template, and passed `npx vue-tsc --noEmit`.
- Completed Step 167: moved `PlayerDock.vue` queue element ref adapter helpers into `useQueuePopover.ts`, kept queue DOM ref normalization with the queue popover state, removed the stale destructured helper, and passed `npx vue-tsc --noEmit`.
- Completed Step 168: narrowed `useQueuePopover.ts` public API by no longer returning internal `setQueueControl` and `setQueueTrackRef`, after moving unknown-element adapters into the composable, and passed `npx vue-tsc --noEmit`.
- Completed Step 169: moved `TrackTable.vue` row fallback labels for unknown artist and local music into `useTrackTableLabels.ts`, removed direct i18n calls from the table template, and passed `npx vue-tsc --noEmit`.
- Completed Step 170: moved `PlayerDock.vue` playback progress label into `usePlayerDockLabels.ts`, removed the dock component's direct i18n dependency, and passed `npx vue-tsc --noEmit`.
- Completed Step 171: moved `LyricsView.vue` fullscreen toggle plus menu-close command into `useLyricsViewInteractions.ts`, removed inline command composition from the template, and passed `npx vue-tsc --noEmit`.
- Completed Step 172: refined `usePluginManagerPresentation.ts` so plugin notification mapping initializes before market localization, installed capability formatting is created after `localizedCapability` is available, removed the interim mutable formatter, verified Chinese copy, and passed `npx vue-tsc --noEmit`.
- Completed Step 173: extracted `TrackTable.vue` album fallback rendering into `TrackAlbumCell.vue`, moved album-cell truncation styling into the cell component without changing row layout, and passed `npx vue-tsc --noEmit`.
- Completed Step 174: extracted `TrackTable.vue` duration formatting/rendering into `TrackDurationCell.vue`, moved duration-cell display styling into the cell component, and passed `npx vue-tsc --noEmit`.
- Completed Step 175: extracted `TrackTable.vue` track-number rendering into `TrackIndexCell.vue`, moved number-cell display styling into the cell component, and passed `npx vue-tsc --noEmit`.
- Completed Step 176: moved `TrackArtistCell.vue` base artist-cell truncation/color styling into the component, reduced `TrackTable.vue` parent styling of child cell internals, and passed `npx vue-tsc --noEmit`.
- Completed Step 177: moved action-cell alignment from `TrackTable.vue` into `TrackRowActions.vue`, reduced parent selectors that assume child cell structure, and passed `npx vue-tsc --noEmit`.
- Completed Step 178: replaced `TrackTable.vue` broad child `span` fallback styling with an explicit `.track-extra-cells` slot wrapper and `:slotted(*)` styling for extra columns, and passed `npx vue-tsc --noEmit`.
- Completed Step 179: extracted `SleepTimerDialog.vue` preset minute grid into `SleepTimerPresetGrid.vue`, moved preset button selection and styling into the focused child component, and passed `npx vue-tsc --noEmit`.
- Completed Step 180: extracted `SleepTimerDialog.vue` custom hours/minutes inputs into `SleepTimerCustomTimeInputs.vue`, moved input parsing and styles into the focused child component, and passed `npx vue-tsc --noEmit`.
- Completed Step 181: extracted `SleepTimerDialog.vue` ending action radio group into `SleepTimerActionOptions.vue`, moved action option styles and event wiring into the focused child component, and passed `npx vue-tsc --noEmit`.
- Completed Step 182: extracted `SleepTimerDialog.vue` footer action buttons into `SleepTimerDialogFooter.vue`, moved active/paused button branching and footer styles into the focused child component, and passed `npx vue-tsc --noEmit`.
- Completed Step 183: extracted the sleep timer dialog divider into `SleepTimerDivider.vue`, moved its private divider styles out of `SleepTimerDialog.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 184: extracted the sleep timer section label into `SleepTimerSectionLabel.vue`, moved repeated label styling out of `SleepTimerDialog.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 185: extracted the playback queue popover header into `PlaybackQueueHeader.vue`, moved title/count/locate behavior and header styles out of `PlaybackQueuePopover.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 186: extracted playback queue track row rendering into `PlaybackQueueTrackRow.vue`, preserved row DOM ref forwarding and play events, moved row/cover/index/time styles out of `PlaybackQueuePopover.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 187: extracted the playback queue list shell and empty state into `PlaybackQueueList.vue`, moved list scrolling/empty styles out of `PlaybackQueuePopover.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 188: extracted the now-playing cover/lyrics toggle button into `NowPlayingCoverButton.vue`, moved cover fallback, hover cue, and cover-roll animation styles out of `NowPlayingInfo.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 189: extracted now-playing title/artist display into `NowPlayingTrackInfo.vue`, moved info-roll transition and text truncation styles out of `NowPlayingInfo.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 190: extracted the now-playing time pair into `NowPlayingTimePair.vue`, moved duration formatting and numeric styles out of `NowPlayingInfo.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 191: extracted plugin market card icon rendering into `PluginMarketIcon.vue`, moved kind-specific icon fallback and icon styles out of `PluginMarketCard.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 192: extracted plugin market card body text, status badge, and tag rendering into `PluginMarketCardBody.vue`, moved text/tag/status styles out of `PluginMarketCard.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 193: extracted the plugin market card action button into `PluginMarketActionButton.vue`, moved status icon branching, disabled/loading behavior, responsive placement, and spinner styles out of `PluginMarketCard.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 194: extracted track metadata dialog footer actions into `track-metadata/TrackMetadataDialogFooter.vue`, moved footer button styles out of `TrackMetadataDialog.vue`, preserved parent form state ownership, and passed `npx vue-tsc --noEmit`.
- Completed Step 195: extracted the track metadata dialog header title block into `track-metadata/TrackMetadataDialogHeader.vue`, moved header truncation styles out of `TrackMetadataDialog.vue`, left form/loading state in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 196: extracted `TrackMetadataDialog.vue` form field refs, reset behavior, save eligibility, and form value assembly into `useTrackMetadataForm.ts`, moved `TrackMetadataFormValue` out of the `.vue` file, updated callers to import the type from the composable, and passed `npx vue-tsc --noEmit`.
- Completed Step 197: extracted track metadata dialog display label derivation into `useTrackMetadataDisplayLabels.ts`, moved filename/bitrate/sample-rate/channel/file-size/date/path formatting out of `TrackMetadataDialog.vue`, left preview/audio loading in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 198: extracted `TrackMetadataDialog.vue` audio info loading into `useTrackMetadataAudioInfo.ts`, moved stale-load protection and reset behavior out of the dialog, kept cover preview lifecycle separate, and passed `npx vue-tsc --noEmit`.
- Completed Step 199: extracted `TrackMetadataDialog.vue` cover preview URL lifecycle into `useTrackMetadataCoverPreview.ts`, moved artwork fallback, thumbnail loading, object URL cleanup, cover error handling, and stale-load protection out of the dialog, and passed `npx vue-tsc --noEmit`.
- Completed Step 200: re-scanned `TrackMetadataDialog.vue` after form/display/audio/cover extraction; it is now a compact dialog composition layer with only form layout, watch orchestration, cleanup, and submit bridging remaining, so no further forced split was made, and `npx vue-tsc --noEmit` passed.
- Completed Step 201: extracted desktop lyrics text rendering into `desktop-lyrics/DesktopLyricsText.vue`, moved lyric text sizing/truncation/shadow styles out of `DesktopLyrics.vue`, kept window events and lyrics loading in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 202: extracted `DesktopLyrics.vue` current lyric line and title derivation into `useDesktopLyricsCurrentLine.ts`, left lyrics parsing and window control in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 203: extracted `DesktopLyrics.vue` lyric source parsing/loading watcher into `useDesktopLyricsLoader.ts`, moved raw/source lyric parsing, line normalization, loading state, and stale-load protection out of the window component, preserved desktop window event ownership, and passed `npx vue-tsc --noEmit`.
- Completed Step 204: extracted `DesktopLyrics.vue` window position persistence helpers into `useDesktopLyricsWindowPosition.ts`, moved current-position saving, delayed move-save scheduling, and timer cleanup out of the component, kept action dispatch in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 205: extracted desktop lyrics runtime state refs and payload application into `useDesktopLyricsRuntimeState.ts`, moved track-key comparison and incoming state assignment out of `DesktopLyrics.vue`, kept window/action control in the component, and passed `npx vue-tsc --noEmit`.
- Completed Step 206: verified `DesktopLyrics.vue` is now a compact window shell after runtime/loader/current-line/position extraction, chose not to over-split the remaining window lifecycle/action dispatch, and passed `npx vue-tsc --noEmit`.
- Completed Step 207: extracted `CollectionHero.vue` action buttons into `CollectionHeroActions.vue`, moved play/locate button icons, events, disabled behavior, and responsive button styles out of the hero parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 208: extracted `CollectionHero.vue` title/subtitle/date text into `CollectionHeroText.vue`, moved responsive heading/subtitle/date styles out of the hero parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 209: verified `CollectionHero.vue` is now a thin hero layout component after text/action extraction, cleaned leftover empty media-block spacing from the extraction, and passed `npx vue-tsc --noEmit`.
- Completed Step 210: extracted `SearchInput.vue` optional Enter hint rendering into `SearchEnterHint.vue`, moved hint/kbd responsive styles out of the generic input, left existing root visual variants unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 211: extracted `VolumeControl.vue` popover rail/range rendering into `VolumePopover.vue`, moved vertical range input, percentage rail/thumb, popover visibility, and value text styles out of the parent control, kept mute button and blur behavior in `VolumeControl.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 212: extracted `VolumeControl.vue` mute button into `VolumeMuteButton.vue`, moved the volume icon and focus/hover button styles out of the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 213: verified `VolumeControl.vue` is now a thin container around `VolumePopover` and `VolumeMuteButton`, cleaned leftover spacing from the extraction, and passed `npx vue-tsc --noEmit`.
- Completed Step 214: extracted the desktop lyrics entry button from `PlaybackMetaControls.vue` into `DesktopLyricsEntryButton.vue`, moved its icon, label/title, and button sizing styles out of the meta controls parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 215: verified `PlaybackMetaControls.vue` is now a player-dock composition boundary with child controls handling their own UI, cleaned leftover empty style spacing from the last extraction, and passed `npx vue-tsc --noEmit`.
- Completed Step 216: extracted `PlaybackSpeedControl.vue` speed popover rail/range rendering into `PlaybackSpeedPopover.vue`, moved vertical speed input, percentage rail/thumb, popover visibility, and value text styles out of the parent control, and passed `npx vue-tsc --noEmit`.
- Completed Step 217: extracted `PlaybackSpeedControl.vue` trigger button into `PlaybackSpeedButton.vue`, moved the speed icon and focus/hover button styles out of the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 218: verified `PlaybackSpeedControl.vue` is now a thin container around `PlaybackSpeedPopover` and `PlaybackSpeedButton`, cleaned leftover empty style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 219: extracted duplicated `PlaybackOptionControls.vue` option popover/control rendering into reusable `PlaybackOptionMenu.vue`, moved popover/button/ref-close styles and behavior out of the option controls parent, kept typed quality/lyric event forwarding in `PlaybackOptionControls.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 220: verified `PlaybackOptionControls.vue` is now a small adapter after menu extraction, confirmed Chinese labels remain intact with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 221: extracted `LyricsActionMenu.vue` font-size control block into `LyricsFontSizeControl.vue`, moved font-size title/button/value styles out of the menu parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 222: extracted `LyricsActionMenu.vue` linked-lyrics status display into `LyricsLinkedLyricsStatus.vue`, moved tooltip text composition and truncation styles out of the menu parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 223: extracted reusable `LyricsActionMenu.vue` menu item button rendering into `LyricsMenuItem.vue`, moved menu item disabled/hover/focus styles out of the parent, preserved explicit menu ordering in the template, and passed `npx vue-tsc --noEmit`.
- Completed Step 224: verified `LyricsActionMenu.vue` is now a compact menu composition component after font/status/item extraction, chose not to extract the trivial separator span as over-abstraction, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 225: extracted the plugin market detail capabilities chip list into `PluginDetailCapabilityList.vue`, moved chip list styling out of `PluginMarketDetailPanel.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 226: extracted the plugin market detail permissions list into `PluginDetailPermissionList.vue`, moved icon/chip/empty-state rendering and styles out of `PluginMarketDetailPanel.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 227: extracted the plugin market detail highlights list into `PluginDetailHighlights.vue`, moved conditional list rendering and styles out of `PluginMarketDetailPanel.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 228: extracted the plugin market detail metadata block into `PluginDetailMeta.vue`, moved definition-list rendering and styles out of `PluginMarketDetailPanel.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 229: extracted the plugin market detail description block into `PluginDetailDescription.vue`, leaving `PluginMarketDetailPanel.vue` as a detail composition/layout container, and passed `npx vue-tsc --noEmit`.
- Completed Step 230: extracted the plugin market search field into `PluginMarketSearchField.vue`, moved input/icon rendering and styles out of `PluginMarketMain.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 231: extracted the plugin market status filter buttons into `PluginMarketStatusFilters.vue`, moved filter rendering and styles out of `PluginMarketMain.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 232: extracted the plugin market list/loading/empty rendering into `PluginMarketList.vue`, moved list state rendering and styles out of `PluginMarketMain.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 233: verified `PluginMarketMain.vue` is now a compact market composition layer after search/filter/list extraction, chose not to over-split the remaining outer toolbar/layout shell, and passed `npx vue-tsc --noEmit`.
- Completed Step 234: extracted the download manager track table rendering into `DownloadTrackTable.vue`, moved download-specific table slots and source badge styles out of `DownloadManagerView.vue`, preserved page-owned tab/context-menu state, and passed `npx vue-tsc --noEmit`.
- Completed Step 235: moved download status text formatting into `DownloadTrackTable.vue`, reduced `DownloadManagerView.vue` table-column display responsibility, and passed `npx vue-tsc --noEmit`.
- Completed Step 236: extracted `DownloadManagerView.vue` download item filtering/mapping helpers into `useDownloadManagerItems.ts`, kept tab/context-menu state in the view, preserved existing download row id mapping, and passed `npx vue-tsc --noEmit`.
- Completed Step 237: verified `DownloadManagerView.vue` is now a compact page state container after table/helper extraction, kept tab/context-menu ownership in the page, chose not to over-split the remaining event bridge, and passed `npx vue-tsc --noEmit`.
- Completed Step 238: extracted the playback audio cache directory setting row into `PlaybackAudioCacheDirectorySetting.vue`, moved path input/button focus styles out of `PlaybackAudioCacheSettings.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 239: extracted the playback audio cache management controls/status block into `PlaybackAudioCacheManagement.vue`, moved max-size input/status/button styles out of `PlaybackAudioCacheSettings.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 240: verified `PlaybackAudioCacheSettings.vue` is now a compact cache-settings composition layer after directory/management extraction, chose not to split the remaining composable wiring, and passed `npx vue-tsc --noEmit`.
- Completed Step 241: extracted the lyrics search result row into `LyricsSearchResultRow.vue`, moved row/cover/meta/resolving styles out of `LyricsSearchDialog.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 242: extracted the lyrics search results list/loading/status shell into `LyricsSearchResultsList.vue`, moved remaining results scrolling/state styles out of `LyricsSearchDialog.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 243: verified `LyricsSearchDialog.vue` is now a compact dialog composition layer after result row/list extraction, chose not to over-split the remaining SearchInput/SegmentTabs wiring, and passed `npx vue-tsc --noEmit`.
- Completed Step 244: extracted repeated sidebar main navigation link markup into `SidebarMainNavLink.vue`, moved link/icon/text/collapsed styles out of `SidebarMainNavLinks.vue`, preserved the current hash-link/event navigation behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 245: verified `SidebarMainNavLinks.vue` is now a compact explicit menu composition layer after link extraction, kept current menu navigation behavior unchanged, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 246: extracted plugin table runtime/status badge rendering into `PluginRuntimeBadge.vue` and `PluginStateBadge.vue`, moved badge styles out of `PluginTableRow.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 247: extracted the plugin table drag handle into `PluginDragHandle.vue`, moved pointer/active styles out of `PluginTableRow.vue`, preserved drag event ownership in the row, and passed `npx vue-tsc --noEmit`.
- Completed Step 248: extracted the plugin table capabilities cell into `PluginCapabilitiesCell.vue`, moved capabilities truncation/title rendering out of `PluginTableRow.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 249: verified `PluginTableRow.vue` after badge/drag/capabilities extraction, kept it as the plugin table row layout/event bridge, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 250: extracted the plugin row selection checkbox into `PluginRowSelectCheckbox.vue`, moved checkbox aria/change handling and styles out of `PluginTableRow.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 251: verified `PluginTableRow.vue` is now a focused table row layout/event bridge after row control extraction, kept remaining column/drag-over styling in the row, and passed `npx vue-tsc --noEmit`.
- Completed Step 252: extracted repeated theme card title/author text rendering into `ThemeCardText.vue`, moved shared text truncation styles out of `ThemeBuiltInCard.vue` and `ThemeCustomCard.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 253: extracted the shared theme card selected check indicator into `ThemeCardCheck.vue`, moved check indicator styles out of `ThemeBuiltInCard.vue` and `ThemeCustomCard.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 254: verified theme card components after shared text/check extraction, kept built-in/custom preview styling local because their tone/image/delete behavior differs, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 255: extracted the artist list row into `ArtistListRow.vue`, moved avatar/text/selected styles out of `ArtistListPanel.vue`, exposed the row element so parent-owned scroll positioning still works, and passed `npx vue-tsc --noEmit`.
- Completed Step 256: verified `ArtistListPanel.vue` is now a focused artist list container after row extraction, kept title/scroll/selected-row positioning in the panel, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 257: extracted plugin subscription card rendering/actions into `PluginSubscriptionCard.vue`, moved card body/action button styles out of `PluginSubscriptionsPanel.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 258: verified `PluginSubscriptionsPanel.vue` is now a compact subscriptions form/list composition layer after card extraction, kept list layout and empty state in the panel, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 259: extracted `TrackCoverThumb.vue` cover URL loading/cache/visibility/error-retry logic into `useTrackCoverThumbUrl.ts`, kept rendering in the component, preserved lazy observer wiring with an explicit root ref setter, and passed `npx vue-tsc --noEmit`.
- Completed Step 260: verified `TrackCoverThumb.vue` is now a compact rendering component after cover URL composable extraction, kept placeholder/equalizer/thumbnail styling in the component, and passed `npx vue-tsc --noEmit`.
- Completed Step 261: extracted plugin search load-more footer state rendering into `PluginSearchLoadMoreFooter.vue`, moved footer spinner/error/retry styles out of `PluginSearchResultsList.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 262: extracted plugin search table track mapping/active/preparing adapter logic into `usePluginSearchTableTracks.ts`, kept list rendering/scrolling in `PluginSearchResultsList.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 263: verified `PluginSearchResultsList.vue` is now a focused result list rendering/scroll bridge after footer/composable extraction, kept TrackTable event bridging in the list, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 264: extracted `LibraryPanel.vue` quick navigation row rendering into `LibraryQuickRow.vue`, moved quick-row icon/copy/selected styles out of the panel, and passed `npx vue-tsc --noEmit`.
- Completed Step 265: extracted `LibraryPanel.vue` local folder row rendering into `LibraryFolderRow.vue`, moved folder cover/title/count/selected row styles out of the panel, and passed `npx vue-tsc --noEmit`.
- Completed Step 266: verified `LibraryPanel.vue` is now a compact library navigation panel after quick/folder row extraction, kept title/section/divider/empty-state layout in the panel, and passed `npx vue-tsc --noEmit`.
- Completed Step 267: extracted `SegmentTabs.vue` tab button rendering into `SegmentTabButton.vue`, preserved existing variant styles in the tabs shell, and passed `npx vue-tsc --noEmit`.
- Completed Step 268: verified `SegmentTabs.vue` after tab button extraction, kept variant root-class styles in the tabs shell for now because they are shared across multiple call sites and need visual migration, and passed `npx vue-tsc --noEmit`.
- Completed Step 269: extracted the tray menu now-playing button into `TrayMenuNowPlayingButton.vue`, moved text truncation/button styles out of `TrayMenu.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 270: extracted generic tray menu action button rendering into `TrayMenuActionButton.vue`, moved shared action button styles out of `TrayMenu.vue`, tightened parent styles to avoid controlling child button internals, and passed `npx vue-tsc --noEmit`.
- Completed Step 271: extracted the tray playback mode submenu into `TrayMenuPlaybackModeSubmenu.vue`, moved submenu hover/flyout styles out of `TrayMenu.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 272: verified `TrayMenu.vue` is now a compact tray state/action composition shell after now-playing/action/mode extraction, confirmed Chinese labels remain intact with `rg`, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 273: extracted the sidebar account avatar/status indicator into `SidebarAccountAvatar.vue`, moved avatar/icon/status-dot styles out of `SidebarAccount.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 274: extracted sidebar account meta text into `SidebarAccountMeta.vue`, moved text truncation/online-label/collapsed hiding styles out of `SidebarAccount.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 275: extracted sidebar account action icon button rendering into `SidebarAccountActionButton.vue`, moved active button styling/aria/title binding out of `SidebarAccount.vue`, kept collapsed positioning in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 276: verified `SidebarAccount.vue` is now a compact account layout/positioning shell after avatar/meta/action extraction, tightened action positioning to explicit class passthrough, and passed `npx vue-tsc --noEmit`.
- Completed Step 277: extracted the lyrics panel custom scrollbar into `LyricsPanelScrollbar.vue`, moved scrollbar/thumb styles out of `LyricsPanel.vue`, switched visibility to an explicit prop to avoid parent-selector coupling, and passed `npx vue-tsc --noEmit`.
- Completed Step 278: extracted lyrics panel loading/empty/search state rendering into `LyricsPanelState.vue`, moved hint/empty/search-link styles out of `LyricsPanel.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 279: verified `LyricsPanel.vue` is now a compact lyrics scroll container after scrollbar/state extraction, kept panel sizing/scroll event ownership in the component, cleaned leftover style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 280: extracted scan dialog folder row rendering into `ScanFolderRow.vue`, moved row checkbox/path/delete styles out of `ScanDialog.vue`, fixed two-argument checked event forwarding, and passed `npx vue-tsc --noEmit`.
- Completed Step 281: extracted scan dialog footer action/progress rendering into `ScanDialogFooter.vue`, moved footer/progress styles out of `ScanDialog.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 282: verified `ScanDialog.vue` is now a compact scan dialog composition layer after folder-row/footer extraction, kept toolbar/list/empty-state layout in the dialog, cleaned template/style spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 283: extracted lyrics font-size setting control into `LyricsFontSizeSetting.vue`, moved select label/input styles out of `LyricsSettingsPanel.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 284: extracted lyric font color/theme-color controls into `LyricsFontColorSetting.vue`, moved color-field/theme checkbox styles out of `LyricsSettingsPanel.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 285: verified `LyricsSettingsPanel.vue` is now a focused lyrics settings section after font-size/color extraction, kept the auto-hide checkbox local because it is a single section-level setting, and passed `npx vue-tsc --noEmit`.
- Completed Step 286: scanned remaining larger Vue components, chose `PlaybackSleepTimerSettings.vue` as the next small cleanup target because its default-minute input and completion-action radio group are separate responsibilities.
- Completed Step 287: extracted the sleep-timer completion action radio group into `PlaybackSleepTimerActionSetting.vue`, moved radio-group styles out of `PlaybackSleepTimerSettings.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 288: extracted the sleep-timer default minute number field into `PlaybackSleepTimerMinutesSetting.vue`, moved number-field styles out of `PlaybackSleepTimerSettings.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 289: verified `PlaybackSleepTimerSettings.vue` is now a thin composition layer after minute/action extraction, kept event forwarding local, confirmed Chinese labels live in child components with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 290: scanned the next settings components and chose `McpSettingsPanel.vue` because its auto-start checkbox/note is an independent setting block mixed into the MCP panel shell.
- Completed Step 291: extracted the MCP auto-start checkbox/note into `McpAutoStartSetting.vue`, moved checkbox/note styles out of `McpSettingsPanel.vue`, fixed the MCP feature heading text, and passed `npx vue-tsc --noEmit`.
- Completed Step 292: verified `McpSettingsPanel.vue` is now a focused MCP settings composition shell after auto-start extraction, kept the local feature group data in the panel because it only serves this page, confirmed the feature heading is readable with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 293: scanned `McpStatusPanel.vue` and chose its status header as the next split because the refresh/loading logic should stay in the panel while the badge/button rendering can be a pure child component.
- Completed Step 294: extracted the MCP status header badge/refresh button into `McpStatusHeader.vue`, moved header/pill/button focus styles out of `McpStatusPanel.vue`, kept refresh state ownership in the panel, and passed `npx vue-tsc --noEmit`.
- Completed Step 295: inspected the remaining MCP status details grid and chose to extract it because it is pure display while `McpStatusPanel.vue` should keep data fetching and label formatting.
- Completed Step 296: extracted the MCP status details grid into `McpStatusDetails.vue`, moved grid styles out of `McpStatusPanel.vue`, kept fetch/error/restart-policy formatting in the panel, and passed `npx vue-tsc --noEmit`.
- Completed Step 297: verified `McpStatusPanel.vue` is now a focused MCP status state/fetching shell after header/details extraction, kept worker health loading/error ownership in the panel, confirmed visible labels live in the child display components with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 298: scanned `McpConnectionPanel.vue` and chose its endpoint list as the next split because connection addresses are pure display while JSON copy state should remain in the panel for now.
- Completed Step 299: extracted the MCP endpoint list into `McpEndpointList.vue`, moved endpoint-list/code styles out of `McpConnectionPanel.vue`, kept JSON copy state in the panel, and passed `npx vue-tsc --noEmit`.
- Completed Step 300: extracted the MCP config JSON copy/code block into `McpConfigCodeBlock.vue`, moved code-heading/config-code/button styles out of `McpConnectionPanel.vue`, kept clipboard state ownership in the panel, and passed `npx vue-tsc --noEmit`.
- Completed Step 301: verified `McpConnectionPanel.vue` is now a focused MCP connection state/composition panel after endpoint/config extraction, kept the explanatory note and clipboard message ownership local, confirmed visible labels live in the child display components with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 302: scanned `PlaybackAudioCacheManagement.vue` and chose its cache max-size number field as the next split because the field input/change handling is independent from the clear-cache action and usage summary.
- Completed Step 303: extracted the playback audio cache max-size field into `PlaybackAudioCacheSizeField.vue`, moved cache-size-field/input styles out of `PlaybackAudioCacheManagement.vue`, kept refresh-after-change coordination in the management component, and passed `npx vue-tsc --noEmit`.
- Completed Step 304: inspected the remaining playback audio cache management row/action styles and chose to extract the clear-cache action because its button rendering/focus styles are independent from the management row layout and usage summary.
- Completed Step 305: extracted the playback audio cache clear action into `PlaybackAudioCacheClearAction.vue`, moved action/button styles out of `PlaybackAudioCacheManagement.vue`, kept clear-cache ownership in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 306: verified `PlaybackAudioCacheManagement.vue` is now a compact cache management composition block after size/action extraction, kept usage summary and refresh coordination local, confirmed bilingual labels with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 307: scanned remaining settings components and chose `PlaybackAudioCacheDirectorySetting.vue` because its path input and directory action buttons are separate responsibilities, while a shared generic field abstraction would be premature.
- Completed Step 308: extracted the playback audio cache directory action buttons into `PlaybackAudioCacheDirectoryActions.vue`, moved compact button hover/focus styles out of `PlaybackAudioCacheDirectorySetting.vue`, kept path input ownership in the directory setting, and passed `npx vue-tsc --noEmit`.
- Completed Step 309: verified `PlaybackAudioCacheDirectorySetting.vue` is now a focused path-field setting after action extraction, kept path input/layout ownership local, confirmed bilingual labels are passed into the child action component, and passed `npx vue-tsc --noEmit`.
- Completed Step 310: scanned `PlaybackAudioOutputSettings.vue` and chose its refresh action button as the next small split because output-device loading stays in the setting while the compact refresh button can own its own button styles.
- Completed Step 311: extracted the playback audio output refresh button into `PlaybackAudioOutputRefreshButton.vue`, moved compact button hover/focus styles out of `PlaybackAudioOutputSettings.vue`, kept output device loading/selection ownership in the setting, and passed `npx vue-tsc --noEmit`.
- Completed Step 312: inspected `PlaybackAudioOutputSettings.vue` after refresh button extraction and chose to extract the output device select because option rendering/select styling is independent from device loading and refresh orchestration.
- Completed Step 313: extracted the playback audio output device select into `PlaybackAudioOutputDeviceSelect.vue`, moved select/option styles out of `PlaybackAudioOutputSettings.vue`, kept device loading and change handling in the setting, and passed `npx vue-tsc --noEmit`.
- Completed Step 314: verified `PlaybackAudioOutputSettings.vue` is now a focused output-device loading/composition setting after select/refresh extraction, kept row layout and device refresh lifecycle local, confirmed visible labels with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 315: scanned `GeneralBehaviorSettings.vue` and chose its close-action radio group as the next split because close-window behavior and search-history limit are separate settings.
- Completed Step 316: extracted the general close-action radio group into `GeneralCloseActionSetting.vue`, moved close-action option styles out of `GeneralBehaviorSettings.vue`, kept behavior setting event forwarding in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 317: extracted the general search-history limit radio group into `GeneralSearchHistoryLimitSetting.vue`, moved history option styles out of `GeneralBehaviorSettings.vue`, kept option list ownership in the behavior settings shell, and passed `npx vue-tsc --noEmit`.
- Completed Step 318: verified `GeneralBehaviorSettings.vue` is now a thin behavior settings composition layer after close-action/history extraction, kept the local history option list in the shell, and passed `npx vue-tsc --noEmit`.
- Completed Step 319: scanned `PlaybackFallbackSettings.vue` and chose its quality-fallback radio group as the next split because quality retry behavior and playback-failure behavior are separate settings.
- Completed Step 320: extracted the playback quality-fallback radio group into `PlaybackQualityFallbackSetting.vue`, moved its option styles out of `PlaybackFallbackSettings.vue`, removed the now-unused parent `t` import, and passed `npx vue-tsc --noEmit`.
- Completed Step 321: extracted the playback failure-action radio group into `PlaybackFailureActionSetting.vue`, moved the remaining radio group styles out of `PlaybackFallbackSettings.vue`, kept fallback option data in the settings shell, and passed `npx vue-tsc --noEmit`.
- Completed Step 322: verified `PlaybackFallbackSettings.vue` is now a thin fallback settings composition layer after quality/failure extraction, kept fixed option arrays in the shell, confirmed visible Chinese labels with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 323: scanned `PlaybackTransitionsSettings.vue`, confirmed visible Chinese labels are intact with `rg`, and chose its repeated transition checkbox row as the next split because each row has identical rendering/change handling.
- Completed Step 324: extracted the playback transition checkbox row into `PlaybackTransitionOptionRow.vue`, moved row checkbox styles out of `PlaybackTransitionsSettings.vue`, kept transition labels and event routing in the setting, and passed `npx vue-tsc --noEmit`.
- Completed Step 325: verified `PlaybackTransitionsSettings.vue` is now a focused transition settings group after row extraction, kept labels/event routing and option-list layout local, confirmed real Chinese text with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 326: scanned `SidebarPlaylistNavList.vue` and chose its playlist navigation item as the next split because list scrolling belongs in the parent while each playlist button can own its icon/text/collapsed styles and click/context-menu events.
- Completed Step 327: extracted the sidebar playlist navigation item into `SidebarPlaylistNavItem.vue`, moved playlist item/icon/text/collapsed styles out of `SidebarPlaylistNavList.vue`, used explicit multi-argument context-menu forwarding, and passed `npx vue-tsc --noEmit`.
- Completed Step 328: verified `SidebarPlaylistNavList.vue` is now a focused scrolling playlist list container after item extraction, kept scrollbar visibility ownership in the parent and item UI ownership in `SidebarPlaylistNavItem.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 329: scanned playback control components, skipped `PlaybackMetaControls.vue` because it is already a composition shell, and chose `SleepTimerControl.vue` because its trigger button is independent from dialog/status-popover orchestration.
- Completed Step 330: extracted the sleep-timer trigger button into `SleepTimerTriggerButton.vue`, moved button/icon/active styles out of `SleepTimerControl.vue`, kept dialog/status-popover orchestration in the control, and passed `npx vue-tsc --noEmit`.
- Completed Step 331: verified `SleepTimerControl.vue` is now a focused sleep-timer popover/dialog composition control after trigger button extraction, kept positioning ownership local, confirmed trigger labels live in `SleepTimerTriggerButton.vue` with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 332: scanned popover controls, deferred a generic vertical slider abstraction for volume/speed because it would touch two visual controls at once, and chose `SleepTimerStatusPopover.vue` because its action buttons are an isolated display/action group.
- Completed Step 333: extracted the sleep-timer status action buttons into `SleepTimerStatusActions.vue`, moved action button styles out of `SleepTimerStatusPopover.vue`, kept popover header/progress/message ownership in the popover, and passed `npx vue-tsc --noEmit`.
- Completed Step 334: verified `SleepTimerStatusPopover.vue` is now a focused sleep-timer status popover after action extraction, kept header/progress/message styles local, confirmed action labels live in `SleepTimerStatusActions.vue` with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 335: scanned theme card components and chose `ThemeCustomCard.vue` because its delete button is a custom-theme-only action mixed into the preview/card rendering.
- Completed Step 336: extracted the custom theme delete button into `ThemeCustomDeleteButton.vue`, moved delete-button icon/action styles out of `ThemeCustomCard.vue`, kept remove-theme ownership in the card, and passed `npx vue-tsc --noEmit`.
- Completed Step 337: replaced `ThemeCustomDeleteButton.vue` global parent hover/focus selectors with explicit CSS variables set by `ThemeCustomCard.vue`, keeping button visibility ownership clear, and passed `npx vue-tsc --noEmit`.
- Completed Step 338: verified `ThemeCustomCard.vue` after delete-button extraction/visibility cleanup, kept preview/selection styling in the card and delete action styling in `ThemeCustomDeleteButton.vue`, confirmed no global parent selector remains with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 339: scanned track action/cover components, skipped `TrackCoverEqualizer.vue` because it is a single visual control, and chose `TrackRowActions.vue` because favorite and download actions are separate row controls.
- Completed Step 340: extracted the track row favorite action button into `TrackFavoriteActionButton.vue`, moved favorite button/icon/focus styles out of `TrackRowActions.vue`, kept favorite action ownership in the row action group, and passed `npx vue-tsc --noEmit`.
- Completed Step 341: extracted the track row download action button into `TrackDownloadActionButton.vue`, moved download button/spinner/focus styles out of `TrackRowActions.vue`, kept track-level event ownership in the row action group, and passed `npx vue-tsc --noEmit`.
- Completed Step 342: verified `TrackRowActions.vue` is now a focused track action group after favorite/download extraction, kept only action layout and track event forwarding in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 343: scanned remaining medium components, kept `PluginTable.vue` as a table shell for now, and chose `PlaybackQueueTrackRow.vue` because queue track text rendering is separable from row layout/cover/index/duration.
- Completed Step 344: extracted the playback queue track info text block into `PlaybackQueueTrackInfo.vue`, moved queue-info truncation/text styles out of `PlaybackQueueTrackRow.vue`, kept row layout/cover/index/duration ownership in the row, and passed `npx vue-tsc --noEmit`.
- Completed Step 345: verified `PlaybackQueueTrackRow.vue` is now a focused queue row layout after track info extraction, kept index/cover/duration/row state ownership local, merged duplicate time styles introduced by the split, and passed `npx vue-tsc --noEmit`.
- Completed Step 346: scanned `PluginRowActions.vue` and chose its link-style install/update/remove actions as the next split because these buttons share rendering/styling while the enable/disable toggle is a distinct control.
- Completed Step 347: extracted the plugin row link action button into `PluginRowLinkActionButton.vue`, moved install/update/remove link-action styles out of `PluginRowActions.vue`, kept action conditions and plugin payload ownership in the row actions component, and passed `npx vue-tsc --noEmit`.
- Completed Step 348: extracted the plugin row enable/disable toggle into `PluginRowToggleActionButton.vue`, moved toggle status-dot/title styles out of `PluginRowActions.vue`, kept plugin-manifest event ownership in the row action group, and passed `npx vue-tsc --noEmit`.
- Completed Step 349: verified `PluginRowActions.vue` is now a focused plugin row action composition layer after link/toggle extraction, kept action visibility rules and plugin payload forwarding local, confirmed visible labels with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 350: scanned `SidebarBrand.vue` and chose the brand mark/expand affordance as the next split because it has its own collapsed-state interaction and visual styles separate from the brand layout.
- Completed Step 351: extracted the sidebar brand mark button into `SidebarBrandMark.vue`, moved brand-mark/expand-glyph collapsed interaction styles out of `SidebarBrand.vue`, kept brand layout ownership in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 352: inspected the remaining sidebar brand collapse button and chose to extract it because its icon button rendering/glyph styles are separate from brand layout and text.
- Completed Step 353: extracted the sidebar brand collapse button into `SidebarBrandCollapseButton.vue`, moved collapse-button/glyph styles out of `SidebarBrand.vue`, kept collapse label/event ownership in the brand layout, and passed `npx vue-tsc --noEmit`.
- Completed Step 354: verified `SidebarBrand.vue` is now a focused sidebar brand layout after brand mark/collapse button extraction, kept text/collapsed layout ownership local, confirmed mark/collapse styles live in child components with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 355: scanned collection/base components, kept `BaseDialog.vue` and `BaseContextMenu.vue` intact as foundational primitives, and chose `CollectionHeroActions.vue` because play/locate buttons are separate hero actions with separate styles.
- Completed Step 356: extracted the collection hero play button into `CollectionHeroPlayButton.vue`, moved play-button/active/disabled/responsive styles out of `CollectionHeroActions.vue`, kept action layout ownership in the hero actions component, and passed `npx vue-tsc --noEmit`.
- Completed Step 357: extracted the collection hero locate button into `CollectionHeroLocateButton.vue`, moved locate-button/icon/disabled/responsive styles out of `CollectionHeroActions.vue`, kept action row layout ownership in the hero actions component, and passed `npx vue-tsc --noEmit`.
- Completed Step 358: verified `CollectionHeroActions.vue` is now a focused hero action row after play/locate extraction, kept only action row spacing/responsive margins local, cleaned leftover empty media-query spacing, and passed `npx vue-tsc --noEmit`.
- Completed Step 359: scanned remaining medium components and chose `PluginDetailScreenshots.vue` because screenshot frame navigation and dot pagination are separable from the screenshot section shell.
- Completed Step 360: extracted the plugin screenshot navigation button into `PluginScreenshotNavButton.vue`, moved nav button positioning/hover styles out of `PluginDetailScreenshots.vue`, kept previous/next event ownership in the screenshot section, and passed `npx vue-tsc --noEmit`.
- Completed Step 361: extracted the plugin screenshot pagination dots into `PluginScreenshotDots.vue`, moved dot button styles out of `PluginDetailScreenshots.vue`, kept active screenshot state ownership in the screenshot section, and passed `npx vue-tsc --noEmit`.
- Completed Step 362: verified `PluginDetailScreenshots.vue` is now a focused screenshot section shell after nav/dots extraction, kept frame/title/image ownership local, confirmed screenshot labels with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 363: scanned `TrackMetadataSummary.vue` and chose its cover preview block as the next split because cover rendering/error handling is separate from the file info list.
- Completed Step 364: extracted the track metadata cover preview into `TrackMetadataCoverPreview.vue`, moved cover image/default-cover/responsive styles out of `TrackMetadataSummary.vue`, kept cover-error ownership in the summary, and passed `npx vue-tsc --noEmit`.
- Completed Step 365: extracted the track metadata file info list into `TrackMetadataFileInfo.vue`, moved metadata-file-info layout/truncation styles out of `TrackMetadataSummary.vue`, kept summary composition and cover-error forwarding local, and passed `npx vue-tsc --noEmit`.
- Completed Step 366: verified `TrackMetadataSummary.vue` is now a focused metadata summary composition aside after cover/file-info extraction, kept only summary spacing local, confirmed file-info labels live in `TrackMetadataFileInfo.vue` with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 367: scanned plugin subscription/market components and chose `PluginSubscriptionCard.vue` because subscription body text and sync/delete actions are separate card responsibilities.
- Completed Step 368: extracted the plugin subscription card body text into `PluginSubscriptionCardBody.vue`, moved body/text truncation styles out of `PluginSubscriptionCard.vue`, kept subscription payload ownership in the card, and passed `npx vue-tsc --noEmit`.
- Completed Step 369: extracted the plugin subscription sync/delete actions into `PluginSubscriptionCardActions.vue`, moved action button visibility/styles out of `PluginSubscriptionCard.vue`, used explicit CSS variables for card hover/focus visibility, and passed `npx vue-tsc --noEmit`.
- Completed Step 370: verified `PluginSubscriptionCard.vue` is now a focused subscription card shell after body/action extraction, kept card frame/hover variable ownership local, confirmed action labels live in `PluginSubscriptionCardActions.vue` with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 371: scanned sidebar/market navigation components and chose `PluginMarketSidebar.vue` because each plugin category button has repeated icon/text/active rendering while the parent should own only the category list layout.
- Completed Step 372: extracted the plugin market category button into `PluginMarketCategoryButton.vue`, moved category icon/text/active/responsive button styles out of `PluginMarketSidebar.vue`, kept sidebar list layout ownership in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 373: verified `PluginMarketSidebar.vue` is now a focused plugin category list container after category button extraction, kept sidebar overflow/responsive direction local, and passed `npx vue-tsc --noEmit`.
- Completed Step 374: scanned the remaining medium-sized plugin components and chose `PluginSubscriptionForm.vue` because the subscription URL input and submit button are separate form controls.
- Completed Step 375: extracted the plugin subscription URL field into `PluginSubscriptionUrlField.vue`, moved input label/focus/disabled styles out of `PluginSubscriptionForm.vue`, kept form add/update event ownership in the form, and passed `npx vue-tsc --noEmit`.
- Completed Step 376: extracted the plugin subscription submit button into `PluginSubscriptionSubmitButton.vue`, moved submit button icon/text styles out of `PluginSubscriptionForm.vue`, kept disabled/add conditions in the form, and passed `npx vue-tsc --noEmit`.
- Completed Step 377: verified `PluginSubscriptionForm.vue` is now a focused subscription form row after URL-field/submit extraction, kept row grid/slot ownership local, confirmed visible labels with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 378: scanned plugin market detail/card components, found `PluginMarketIcon.vue` already owns plugin kind icon rendering, and chose to reuse it in `PluginDetailHeading.vue` instead of keeping duplicate icon logic there.
- Completed Step 379: extended `PluginMarketIcon.vue` with a detail size variant, replaced duplicated plugin kind icon rendering in `PluginDetailHeading.vue`, kept heading text/layout styles in the detail heading, and passed `npx vue-tsc --noEmit`.
- Completed Step 380: verified plugin market icon reuse after detail-heading migration, confirmed `PluginDetailHeading.vue` no longer duplicates lucide kind icon imports/rendering, and passed `npx vue-tsc --noEmit`.
- Completed Step 381: scanned plugin market card/action/filter components and kept them intact because `PluginMarketCard.vue` is already a composition shell and `PluginMarketActionButton.vue` / `PluginMarketStatusFilters.vue` are single-purpose controls.
- Completed Step 382: scanned lyrics/desktop lyrics components and chose `DesktopLyricsControls.vue` because its title, action button group, and spacer are separate toolbar responsibilities.
- Completed Step 383: extracted the desktop lyrics action buttons into `DesktopLyricsActionButtons.vue`, moved button group/button hover styles out of `DesktopLyricsControls.vue`, kept toolbar visibility/title/spacer ownership in the controls shell, and passed `npx vue-tsc --noEmit`.
- Completed Step 384: verified `DesktopLyricsControls.vue` is now a focused desktop lyrics toolbar shell after action button extraction, kept title/visibility/spacer layout local, and passed `npx vue-tsc --noEmit`.
- Completed Step 385: scanned `LyricsSearchResultRow.vue` and chose its cover block as the next split because artwork/default-icon rendering is separate from row selection and metadata text.
- Completed Step 386: extracted the lyrics search result cover into `LyricsSearchResultCover.vue`, moved artwork/default-icon cover styles out of `LyricsSearchResultRow.vue`, widened the artwork prop to accept empty values, and passed `npx vue-tsc --noEmit`.
- Completed Step 387: extracted the lyrics search result metadata text into `LyricsSearchResultMeta.vue`, moved meta truncation/text styles out of `LyricsSearchResultRow.vue`, kept row disabled/apply/resolving ownership in the row, and passed `npx vue-tsc --noEmit`.
- Completed Step 388: verified `LyricsSearchResultRow.vue` is now a focused selectable result row after cover/meta extraction, kept resolving/apply state ownership local, confirmed visible labels live in row/meta components with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 389: scanned `TrackContextMenu.vue` and chose its metadata header block as the next split because track source/artist/album display is separate from the context menu action list.
- Completed Step 390: extracted the track context menu metadata block into `TrackContextMenuMeta.vue`, removed metadata lucide imports from `TrackContextMenu.vue`, kept action ownership in the context menu, and passed `npx vue-tsc --noEmit`.
- Completed Step 391: verified `TrackContextMenu.vue` after metadata extraction, kept the action list local because each action has distinct visibility/disabled/event rules that are clearer inline for now, confirmed menu labels with `rg`, and passed `npx vue-tsc --noEmit`.
- Completed Step 392: scanned `TrackTableHeader.vue`, `FolderCover.vue`, `SearchInput.vue`, and `PlaybackMetaControls.vue`; chose the track table action header because the favorite/download header icons are a small repeated control responsibility while table column layout should stay in `TrackTableHeader.vue`.
- Completed Step 393: extracted the track table favorite/download header icons into `TrackTableActionsHeader.vue`, moved `track-actions-head` styles out of `TrackTableHeader.vue`, kept table header grid/slot ownership in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 394: scanned `FolderCover.vue` usages in library rows, collection hero, and add-to-playlist dialog; chose the mini cover sizing because `LibraryFolderRow.vue` was passing an internal-looking `cover-mini` class to trigger child-owned cover styles.
- Completed Step 395: replaced `LibraryFolderRow.vue`'s implicit `cover-mini` class contract with `FolderCover size="mini"`, renamed mini cover styles to `folder-cover-mini` inside `FolderCover.vue`, kept the cover sizing/background responsibility local, and passed `npx vue-tsc --noEmit`.
- Completed Step 396: scanned `SearchInput.vue` usages and found discover/result/lyrics variants mixed into one shared input; chose the discover search variant first because it is used by only `DiscoverMusicView.vue` and can be moved to a page-owned component with minimal blast radius.
- Completed Step 397: extracted the discover page search field into `DiscoverSearchInput.vue`, moved discover search input/kbd/responsive styles out of the shared `SearchInput.vue`, kept discover query ownership in `DiscoverMusicView.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 398: scanned remaining `SearchInput.vue` variants and chose the plugin search result input because `result-search` is only used by `PluginSearchToolbar.vue` and its layout belongs to the plugin search module.
- Completed Step 399: extracted the plugin result search field into `plugin-search/PluginSearchInput.vue`, moved `result-search` layout/input/responsive styles out of the shared `SearchInput.vue`, kept toolbar query/provider state in `PluginSearchToolbar.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 400: verified `lyrics-search-field` is only used by `LyricsSearchDialog.vue`, so the remaining lyrics-specific search styling belongs in the lyrics dialog module rather than the shared `SearchInput.vue`.
- Completed Step 401: extracted the lyrics dialog search field into `lyrics/LyricsSearchInput.vue`, moved `lyrics-search-field` layout/input styles out of the shared `SearchInput.vue`, kept lyrics query/search ownership in `LyricsSearchDialog.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 402: verified `SearchInput.vue` after variant extraction now only owns the base search form and default top-search sizing; scanned `SegmentTabs.vue` and chose the download manager tabs because `download-tabs` is only used by `DownloadManagerView.vue`.
- Completed Step 403: extracted download manager tabs into `DownloadManagerTabs.vue`, moved `download-tabs` styles out of the shared `SegmentTabs.vue`, kept active tab state in `DownloadManagerView.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 404: scanned remaining `SegmentTabs.vue` page variants and chose `plugin-center-tabs` because it is only used by `PluginManagerView.vue` and belongs to the plugin manager page shell.
- Completed Step 405: extracted plugin center tabs into `plugin-manager/PluginCenterTabs.vue`, moved `plugin-center-tabs` styles out of the shared `SegmentTabs.vue`, kept active plugin-center state in `PluginManagerView.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 406: scanned provider tab usage and chose `provider-tabs` because it is only used by `PluginSearchToolbar.vue` and belongs with the plugin-search module.
- Completed Step 407: extracted plugin provider tabs into `plugin-search/PluginProviderTabs.vue`, moved `provider-tabs` styles out of the shared `SegmentTabs.vue`, kept provider selection state in `PluginSearchToolbar.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 408: verified `lyrics-provider-tabs` is only used by `LyricsSearchDialog.vue`, so the lyrics provider tab styling belongs in the lyrics module rather than the shared `SegmentTabs.vue`.
- Completed Step 409: extracted lyrics provider tabs into `lyrics/LyricsProviderTabs.vue`, moved `lyrics-provider-tabs` styles out of the shared `SegmentTabs.vue`, kept provider/search state in `LyricsSearchDialog.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 410: scanned the remaining settings/theme tab variants; chose `settings-tabs` because it is only used by `SettingsView.vue` and also has a small responsive rule in `responsive.css` that should belong with the settings tabs component.
- Completed Step 411: extracted settings tabs into `settings/SettingsTabs.vue`, moved `settings-tabs` styles and the mobile gap rule out of `SegmentTabs.vue`/`responsive.css`, kept active settings tab state in `SettingsView.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 412: verified `theme-tabs` has no external usages and only remains as dead styling inside `SegmentTabs.vue`.
- Completed Step 413: removed unused `theme-tabs` styles from `SegmentTabs.vue`, leaving it as a structural tab renderer with page-specific styles owned by wrapper components, and passed `npx vue-tsc --noEmit`.
- Completed Step 414: scanned remaining shared-component ownership issues and chose the download manager empty state because `DownloadManagerView.vue` was styling `EmptyState.vue` through a page-specific `class-name` hook.
- Completed Step 415: extracted the download manager empty state into `DownloadEmptyState.vue`, moved download empty sizing/text styles out of `DownloadManagerView.vue`, kept active-tab message selection in the view, and passed `npx vue-tsc --noEmit`.
- Completed Step 416: scanned `EmptyState.vue` usages and chose the library folder empty note because `LibraryPanel.vue` was passing a panel-specific `empty-folder-note` class into the shared empty-state component.
- Completed Step 417: extracted the library folder empty state into `LibraryFolderEmptyState.vue`, moved `empty-folder-note` styles out of `LibraryPanel.vue`, kept folder-list empty condition/message ownership in the panel, and passed `npx vue-tsc --noEmit`.
- Completed Step 418: scanned remaining `EmptyState.vue` custom class usages and chose the plugin table empty state because `PluginTable.vue` was passing `empty-plugins` into the shared empty-state component for table-local padding and text size.
- Completed Step 419: extracted plugin table empty state into `plugin-manager/PluginTableEmptyState.vue`, moved `empty-plugins` styles out of `PluginTable.vue`, kept loading/plugins visibility ownership in the table, and passed `npx vue-tsc --noEmit`.
- Completed Step 420: scanned remaining `EmptyState.vue` custom class usages and chose the workspace collection empty state because it only adds workspace-local top spacing.
- Completed Step 421: extracted the workspace empty state into `WorkspaceEmptyState.vue`, moved workspace empty spacing out of `WorkspaceView.vue`, kept collection empty message ownership in the workspace display composable/view, and passed `npx vue-tsc --noEmit`.
- Completed Step 422: inspected `LyricsPanelState.vue` and chose its lyrics empty state/action block because empty-state layout and the search action button are separate from pending/loading state display.
- Completed Step 423: extracted lyrics empty state into `lyrics/LyricsEmptyState.vue`, moved `lyrics-empty` and `lyrics-search-link` styles out of `LyricsPanelState.vue`, kept pending/loading branch ownership in `LyricsPanelState.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 424: verified direct `EmptyState.vue` usages after wrapper extraction are either plain shared empty states or wrapper-owned custom styles; scanned dialog ownership issues and chose `AddToPlaylistDialog.vue` because it uses `panel-class` plus `:deep` to adjust BaseDialog overflow/header padding.
- Completed Step 425: added a narrow `headerPadding` style hook to `BaseDialog.vue`, updated `AddToPlaylistDialog.vue` to use `overflow="hidden"` and `header-padding="10px 12px"` instead of `:deep` selectors, and passed `npx vue-tsc --noEmit`.
- Completed Step 426: rescanned remaining deep selectors and chose `DownloadTrackTable.vue`'s source badge styling because the extra-cell badge is owned by the download table slot content, not by a parent deep selector over `TrackTable.vue` internals.
- Completed Step 427: extracted the download source badge into `DownloadSourceBadge.vue`, moved badge styles out of `DownloadTrackTable.vue`, kept source/status extra-cell ownership in the download table slot, and passed `npx vue-tsc --noEmit`.
- Completed Step 428: inspected the remaining `DownloadTrackTable.vue` deep selectors and chose a narrow TrackTable API cleanup because download-specific scrollability and context-row highlighting are current parent-side deep overrides of TrackTable internals.
- Completed Step 429: added explicit `scrollable` and `highlightClass` support to `TrackTable.vue`, updated `DownloadTrackTable.vue` to use those props, removed its remaining deep selectors, and passed `npx vue-tsc --noEmit`.
- Completed Step 430: rescanned remaining deep selectors and chose `LibraryContentLayout.vue` -> `LibraryPanel.vue` style ownership because the layout component was styling the panel internals (`library-panel`, `panel-title`, and title heading) through deep selectors.
- Completed Step 431: moved library panel shell/title sizing, padding, border, background, and title styles into `LibraryPanel.vue`, removed deep panel selectors from `LibraryContentLayout.vue`, kept the layout component focused on grid slots and transition, and passed `npx vue-tsc --noEmit`.
- Completed Step 432: rescanned remaining deep selectors, kept `BaseContextMenu.vue` and wrapper-owned deep styling intact, then scanned medium components and chose the repeated theme card cover skeleton shared by `ThemeBuiltInCard.vue` and `ThemeCustomCard.vue`.
- Completed Step 433: extracted the repeated theme card CSS cover skeleton into `theme/ThemeCardCover.vue`, reused it in `ThemeBuiltInCard.vue` and `ThemeCustomCard.vue`, kept selection/delete/image behavior local to each card, and passed `npx vue-tsc --noEmit`.
- Completed Step 434: scanned theme card components and avoided a broad shell extraction because built-in/import cards are buttons while custom cards use article keyboard handling; chose the smaller repeated preview image styling shared by built-in and custom theme cards.
- Completed Step 435: extracted theme card preview image rendering into `theme/ThemeCardPreviewImage.vue`, reused it in built-in and custom theme cards, removed duplicated image styles, kept preview-image presence decisions local, and passed `npx vue-tsc --noEmit`.
- Completed Step 436: scanned remaining theme card duplication and kept broad card-shell extraction on hold because built-in/import/custom cards use different semantic roots and interaction rules; chose `PlaybackOptionMenu.vue` next because each option row is a focused menu item with local active/disabled styling.
- Completed Step 437: extracted playback option menu items into `player-dock/PlaybackOptionMenuItem.vue`, moved menu-item role/active/disabled button styles out of `PlaybackOptionMenu.vue`, kept popover shell and active-value ownership in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 438: scanned player-dock components and chose the duplicated vertical range rail shared by `VolumePopover.vue` and `PlaybackSpeedPopover.vue` because rail/thumb/input rendering is separate from each popover's label and value mapping.
- Completed Step 439: extracted shared vertical range rail rendering into `player-dock/VerticalRangeRail.vue`, reused it in `VolumePopover.vue` and `PlaybackSpeedPopover.vue`, kept mute/rate percent mapping and labels in each popover, fixed the prop naming after an initial type-check failure, and passed `npx vue-tsc --noEmit`.
- Completed Step 440: scanned player-dock popovers after range-rail extraction and chose the sleep timer status progress bar because progress rendering is separate from the status popover header, copy, and actions.
- Completed Step 441: extracted the sleep timer status progress bar into `player-dock/SleepTimerStatusProgress.vue`, moved progress bar styles out of `SleepTimerStatusPopover.vue`, kept popover title/copy/actions ownership in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 442: scanned remaining player-dock components and chose the now-playing cover hover cue because the overlay arrow is separate from the cover/collapse transition and artwork fallback rendering.
- Completed Step 443: extracted the now-playing cover hover cue into `player-dock/NowPlayingCoverHoverCue.vue`, moved overlay arrow styles out of `NowPlayingCoverButton.vue`, kept visibility conditions in the parent button, and passed `npx vue-tsc --noEmit`.
- Completed Step 444: scanned playback queue row components and chose the queue track duration cell because duration formatting/display is separate from row layout, cover, and metadata.
- Completed Step 445: extracted playback queue track duration into `player-dock/PlaybackQueueTrackDuration.vue`, moved duration formatting/time styles out of `PlaybackQueueTrackRow.vue`, widened the duration prop to accept `null` after type-check feedback, and passed `npx vue-tsc --noEmit`.
- Completed Step 446: scanned remaining medium components and chose theme import card text reuse because `ThemeImportCard.vue` duplicates the same title/subtitle typography already owned by `ThemeCardText.vue`.
- Completed Step 447: extended `ThemeCardText.vue` with an optional subtitle path, reused it in `ThemeImportCard.vue`, removed duplicate import-card title/subtitle styles, and passed `npx vue-tsc --noEmit`.
- Completed Step 448: scanned sidebar navigation components and chose `SidebarFavoritesNavLink.vue` because it duplicates `SidebarMainNavLink.vue` layout/collapsed/active styles with only a different icon and event name.
- Completed Step 449: refactored `SidebarFavoritesNavLink.vue` to reuse `SidebarMainNavLink.vue`, removed duplicated favorites link/collapsed/active styles, kept favorites localization and event ownership in the wrapper, and passed `npx vue-tsc --noEmit`.
- Completed Step 450: scanned sidebar navigation and plugin table components; kept `SidebarPlaylistNavItem.vue` intact because it is a button with context-menu behavior, and chose the plugin table name cell because name emphasis is separate from row drag/selection/action orchestration.
- Completed Step 451: extracted the plugin table name cell into `plugin-manager/PluginNameCell.vue`, moved name emphasis styles out of `PluginTableRow.vue`, kept row layout/drag/action orchestration in the row, and passed `npx vue-tsc --noEmit`.
- Completed Step 452: scanned plugin table cells and chose the table select-all checkbox because header selection control is separate from table shell layout and row rendering.
- Completed Step 453: extracted the plugin table select-all checkbox into `plugin-manager/PluginTableSelectAllCheckbox.vue`, kept checked/disabled state in `PluginTable.vue`, moved checkbox styling into the child, and passed `npx vue-tsc --noEmit`.
- Completed Step 454: scanned plugin table and shared header components; chose the settings page header because `PageHeader.vue` still owns settings-specific header/title styles plus a global responsive title rule.
- Completed Step 455: extracted settings page header styling into `settings/SettingsHeader.vue`, updated `SettingsView.vue` to use the wrapper, removed settings header styles from `PageHeader.vue` and `responsive.css`, and passed `npx vue-tsc --noEmit`.
- Completed Step 456: scanned remaining `PageHeader.vue` page-specific styles and chose the plugin manager header because both desktop header styling and mobile adjustments belong to the plugin manager page.
- Completed Step 457: extracted plugin manager header styling into `plugin-manager/PluginManagerHeader.vue`, updated `PluginManagerView.vue` to use it, removed plugin header styles from `PageHeader.vue` and mobile plugin-header overrides from the view, and passed `npx vue-tsc --noEmit`.
- Completed Step 458: verified the remaining `theme-toolbar` and `theme-view-title` styles in `PageHeader.vue` are only used by `ThemeView.vue`.
- Completed Step 459: extracted theme page header styling into `theme/ThemeHeader.vue`, updated `ThemeView.vue` to use it, removed the last page-specific styles from `PageHeader.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 460: verified `PageHeader.vue`, `SearchInput.vue`, and `SegmentTabs.vue` are now structural/shared after wrapper extraction; remaining wrapper-owned deep selectors are localized to page/module wrappers, then chose the plugin search empty/retry state as the next small split.
- Completed Step 461: extracted plugin search empty/retry rendering into `plugin-search/PluginSearchEmptyState.vue`, kept `PluginSearchResultsList.vue` focused on scrolling/table/load-more orchestration, and passed `npx vue-tsc --noEmit`.
- Completed Step 462: extracted artist list title/count rendering into `artists/ArtistListHeader.vue`, kept `ArtistListPanel.vue` focused on selected artist resolution, scrolling, and row refs, and passed `npx vue-tsc --noEmit`.
- Completed Step 463: extracted artist detail hero rendering into `artists/ArtistHero.vue`, moved avatar/title/count styles out of `ArtistsView.vue`, kept selected artist fallback and count labels in the view, and passed `npx vue-tsc --noEmit`.
- Completed Step 464: extracted artist track scroll/table rendering into `artists/ArtistTrackList.vue`, moved track scroll styles and pagination trigger ownership out of `ArtistsView.vue`, kept playback/menu/favorite event forwarding unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 465: extracted artist page search toolbar into `artists/ArtistSearchToolbar.vue`, removed the cross-page `workspace-toolbar` class usage from `ArtistsView.vue`, kept search text ownership in the page, and passed `npx vue-tsc --noEmit`.
- Completed Step 466: extracted workspace track scroll/error/empty/table rendering into `WorkspaceTrackList.vue`, exposed `scrollToTrack` so `WorkspaceView.vue` keeps locate-current-track behavior, moved list scrollbar and error styles into the child, and passed `npx vue-tsc --noEmit`.
- Completed Step 467: extracted workspace search toolbar into `WorkspaceSearchToolbar.vue`, moved toolbar height/responsive rules out of `WorkspaceView.vue`, kept search query state in the page, and passed `npx vue-tsc --noEmit`.
- Completed Step 468: extracted plugin search table/load-more rendering into `plugin-search/PluginSearchTrackResults.vue`, kept scroll/load-more triggering and plugin-track mapping in `PluginSearchResultsList.vue`, moved result-body styling into the child, and passed `npx vue-tsc --noEmit`.
- Completed Step 469: extracted download manager table/empty rendering into `DownloadManagerContent.vue`, kept tab state and context-menu item mapping in `DownloadManagerView.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 470: moved download manager empty-message selection into a page-owned `downloadEmptyMessage` computed, kept `DownloadManagerContent.vue` display-only, and passed `npx vue-tsc --noEmit`.
- Completed Step 471: moved plugin provider-to-tab mapping and empty-provider sentinel handling into `plugin-search/PluginProviderTabs.vue`, kept `PluginSearchToolbar.vue` focused on search input/layout, and passed `npx vue-tsc --noEmit`.
- Completed Step 472: extracted discover quick keyword buttons into `DiscoverQuickKeywords.vue`, moved keyword-list styles out of `DiscoverMusicView.vue`, kept query state and search submission in the page, and passed `npx vue-tsc --noEmit`.
- Completed Step 473: extracted discover hot search buttons into `DiscoverHotActions.vue`, moved hot-action styles and fixed keywords out of `DiscoverMusicView.vue`, kept search submission in the page, and passed `npx vue-tsc --noEmit`.
- Completed Step 474: moved plugin-search result-to-TrackTable mapping and table event remapping into `plugin-search/PluginSearchTrackResults.vue`, kept `PluginSearchResultsList.vue` focused on loading/empty/scroll state, and passed `npx vue-tsc --noEmit`.
- Completed Step 475: rescanned post-cleanup file sizes and high-coupling areas; kept `LyricsView.vue`, `PlayerDock.vue`, `AppMainContent.vue`, and `PluginManagerView.vue` out of this pass because they are central orchestration surfaces that need a separate focused plan, then chose plugin table cell display rules as the next safe cleanup.
- Completed Step 476: extracted plugin author fallback display into `plugin-manager/PluginAuthorCell.vue`, kept `PluginTableRow.vue` drag/selection/actions unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 477: extracted plugin version display into `plugin-manager/PluginVersionCell.vue`, kept `PluginTableRow.vue` focused on row composition and events, and passed `npx vue-tsc --noEmit`.
- Completed Step 478: kept further `PluginTableRow.vue` splitting on hold because it is now mostly row composition, extracted table header/select-all rendering into `plugin-manager/PluginTableHeader.vue`, moved header column styles out of `PluginTable.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 479: extracted plugin table column widths into `plugin-manager/PluginTableColumns.vue`, reused it from `PluginTable.vue`, removed duplicated header/row width rules from `PluginTableHeader.vue` and `PluginTableRow.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 480: rescanned plugin table and installed-panel components after column extraction; kept table shell/row styling as-is because ownership is now clear, then chose the repeated bulk-action buttons as the next small cleanup.
- Completed Step 481: extracted repeated bulk-action button structure into `plugin-manager/PluginBulkActionButton.vue`, kept selected-count and disabled-state decisions in `PluginBulkActions.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 482: rescanned plugin-manager installed panel after bulk action cleanup; table shell, header, columns, rows, empty state, and bulk actions now have clear ownership, so moved on from this area to avoid component noise.
- Completed Step 483: extracted track metadata error rendering into `track-metadata/TrackMetadataError.vue`, moved error styles out of `TrackMetadataDialog.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 484: extracted track metadata dialog body shell into `track-metadata/TrackMetadataDialogBody.vue`, moved two-column layout and responsive rules out of `TrackMetadataDialog.vue`, kept form state/loading logic in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 485: rescanned track metadata components after body extraction; `TrackMetadataDialog.vue` now mainly owns form/load lifecycle, then chose repeated metadata editor field markup as the next local cleanup.
- Completed Step 486: extracted reusable track metadata editor field markup/styles into `track-metadata/TrackMetadataField.vue`, kept field state and explicit update events in `TrackMetadataEditor.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 487: extracted repeated track metadata file-info rows into `track-metadata/TrackMetadataInfoRow.vue`, kept label/value ownership in `TrackMetadataFileInfo.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 488: rescanned track metadata after field/info-row cleanup; dialog, body, editor fields, file-info rows, summary, and error display now have clear local ownership, so moved on before touching higher-risk orchestration refactors.
- Completed Step 489: reused `TrackContextMenuMeta.vue` inside `DownloadItemContextMenu.vue`, removed duplicate ID/artist/album icon markup from the download menu, kept download action behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 490: extracted repeated download context menu action button structure into `DownloadContextMenuAction.vue`, kept action visibility/disabled/event decisions in `DownloadItemContextMenu.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 491: rescanned download/context-menu cleanup state and found the same action-button structure repeated in `TrackContextMenu.vue`; chose to promote the download action wrapper into a generic context-menu action component instead of keeping a one-off wrapper.
- Completed Step 492: replaced download and track context menu action buttons with shared `ContextMenuAction.vue`, removed the one-off `DownloadContextMenuAction.vue`, kept menu visibility/disabled/business events in each menu, and passed `npx vue-tsc --noEmit`.
- Completed Step 493: rescanned context-menu components after shared action extraction; kept remaining menu visibility/source helpers local because they are business-specific, then chose download-table status text as the next display-only cleanup.
- Completed Step 494: extracted download status text rendering into `DownloadStatusCell.vue`, kept `DownloadTrackTable.vue` focused on TrackTable slot composition, and passed `npx vue-tsc --noEmit`.
- Completed Step 495: rescanned download table/menus after status-cell cleanup; download table is now display-focused, then found `PlaylistContextMenu.vue` still used raw menuitem buttons while track/download menus use shared actions.
- Completed Step 496: replaced playlist context menu raw action buttons with `ContextMenuAction.vue`, aligned playlist/track/download context menu action structure, kept playlist rename/delete behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 497: rescanned context-menu components and confirmed raw `role="menuitem"` button usage is now centralized through `ContextMenuAction.vue`; kept remaining context-menu conditions local because they encode menu-specific behavior.
- Completed Step 498: extracted folder cover grid/single-image/placeholder rendering into `FolderCoverContent.vue`, kept cover URL state and error handling in `FolderCover.vue`, moved image/cell/placeholder styles into the child with local classes, and passed `npx vue-tsc --noEmit`.
- Completed Step 499: rescanned cover-related components after `FolderCoverContent.vue` extraction; kept `TrackCoverEqualizer.vue` intact because its spectrum math/animation/debug behavior is cohesive, then chose `TrackCoverThumb.vue` content rendering as the next safe split.
- Completed Step 500: extracted track cover thumbnail image/placeholder/equalizer rendering into `TrackCoverThumbContent.vue`, kept cover URL loading/error state in `TrackCoverThumb.vue`, moved image/placeholder styles into the child, and passed `npx vue-tsc --noEmit`.
- Completed Step 501: rescanned cover/thumb components and remaining medium components; cover rendering now has clear parent-state/child-rendering ownership, then chose scan dialog empty-list display as the next small private-style cleanup.
- Completed Step 502: extracted scan dialog empty-list rendering into `ScanDialogEmptyState.vue`, moved empty-message styles out of `ScanDialog.vue`, kept folder list state in the dialog, and passed `npx vue-tsc --noEmit`.
- Completed Step 503: rescanned dialog components after scan empty-state cleanup and chose the add-to-playlist dialog title because it is a pure display block with parent-owned styles.
- Completed Step 504: extracted add-to-playlist dialog header rendering into `AddToPlaylistDialogHeader.vue`, moved title/count styles out of `AddToPlaylistDialog.vue`, kept list/create/add behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 505: extracted add-to-playlist dialog row/list rendering into `AddToPlaylistDialogList.vue`, moved list/row/create-cover styles out of `AddToPlaylistDialog.vue`, fixed a script-block regression caught by typecheck, and passed `npx vue-tsc --noEmit`.
- Completed Step 506: rescanned dialog cleanup state; add-to-playlist and scan dialogs now have clear private components, then chose the playlist name field because its input markup/styles are private to `PlaylistDialog.vue`.
- Completed Step 507: extracted playlist name input rendering into `PlaylistNameField.vue`, moved input styles out of `PlaylistDialog.vue`, kept dialog title/submit/name state in the parent, and passed `npx vue-tsc --noEmit`.
- Completed Step 508: ran the final small-refactor-pass rescan and final `npx vue-tsc --noEmit`; current low-risk display/style ownership cleanup is complete. Next recommended phase should be planned separately around central orchestration surfaces (`LyricsView.vue`, `PlayerDock.vue`, `TrackTable.vue`, `AppMainContent.vue`, `AppPageOutlet.vue`, `DiscoverMusicPage.vue`) with explicit behavior checkpoints instead of continuing opportunistic micro-splits.
- Completed Step 509: wrote the central-orchestration refactor plan, extracted shared `AppLayoutVariant` typing and `resolveAppLayoutVariant` into `useAppLayoutVariant.ts`, updated `AppLayout.vue` and `AppMainContent.vue` to share that boundary, and passed `npx vue-tsc --noEmit`.

## Central Orchestration Refactor Plan

Assumptions:
- Menu navigation is currently state-driven (`useLibraryNavigation`) instead of URL-router-driven; do not introduce Vue Router in this pass without a dedicated route/history decision.
- `AppLayout` is the correct shell for the left sidebar, hidden/visible library column, right content outlet, and resize handle.
- Page-specific state should remain in each page or focused page composable; central components should mostly compose props/events and navigation state.

Success criteria for this phase:
- Each step preserves current behavior and passes `npx vue-tsc --noEmit` before the execution document is marked complete.
- `AppMainContent.vue` stops owning reusable layout decision logic.
- `AppPageOutlet.vue` becomes easier to split by view without hiding page-owned state or changing event contracts.
- High-risk components (`LyricsView.vue`, `PlayerDock.vue`, `TrackTable.vue`, `DiscoverMusicPage.vue`) are only touched after a focused checkpoint list is written for that component.

Planned sequence:
- Step 509: centralize `AppLayout` variant typing and `resolveLayoutVariant` outside `AppMainContent.vue`, then verify typecheck.
- Completed Step 510: added `useAppPageOutletMode.ts` to name the `LibraryHomePage` vs `WorkspaceView` outlet predicates, updated `AppPageOutlet.vue` to use those helpers instead of repeating compound conditions, and passed `npx vue-tsc --noEmit`.
- Completed Step 511: extracted the static utility page branch into `AppUtilityPageOutlet.vue`, added an `isUtilityOutlet` predicate, removed direct settings/theme/plugins imports from `AppPageOutlet.vue`, kept plugin notifications forwarded unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 512: extracted the downloads branch into `AppDownloadsPageOutlet.vue`, kept `DownloadManagerView.vue` ownership and event contracts unchanged, reduced direct imports and branch weight in `AppPageOutlet.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 513: extracted the artists branch into `AppArtistsPageOutlet.vue`, kept artist selection, query, track-menu, playback, selection, and favorite events forwarded unchanged, reduced direct page ownership in `AppPageOutlet.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 514: extracted the local workspace branch into `AppWorkspacePageOutlet.vue`, moved workspace-only `preparingTrackId` and playlist-view mapping out of `AppPageOutlet.vue`, preserved query, artist, track-menu, playback, selection, and favorite event contracts, and passed `npx vue-tsc --noEmit`.
- Completed Step 515: extracted the library home branch into `AppLibraryHomePageOutlet.vue`, kept folder navigation, recent-added panel actions, scan/rescan, track menu, playback, selection, favorite, and query events forwarded unchanged, removed direct `LibraryHomePage.vue` rendering from `AppPageOutlet.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 516: extracted the discover branch into `AppDiscoverPageOutlet.vue`, kept online-search ready/started/updated lifecycle forwarding explicit, preserved online track menu/play/download/favorite/back-local events, kept `DiscoverMusicPage.vue` as the owner of search state, and passed `npx vue-tsc --noEmit`.
- Completed Step 517: rescanned `AppPageOutlet.vue` after branch wrapper extraction, centralized duplicated `LocalFolderItem` and `ArtistGroup` into `src/types/library.ts`, updated app/page/library/artist components to import the shared page data models, and passed `npx vue-tsc --noEmit`.
- Completed Step 518: performed the post-outlet rescan, extracted `AppPageOutletProps` and `AppPageOutletEmits` into `src/types/appPageOutlet.ts`, reduced `AppPageOutlet.vue` script ownership to imports plus outlet mode helpers, and passed `npx vue-tsc --noEmit`.
- Completed Step 519: extracted sidebar wiring into `AppSidebarOutlet.vue`, moved sidebar-specific active-filter display mapping and `PrimarySidebar` event forwarding out of `AppMainContent.vue`, kept menu navigation state-driven and unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 520: centralized `AppMainContentProps` and `AppMainContentEmits` into `src/types/appMainContent.ts`, reduced `AppMainContent.vue` script ownership to layout/outlet imports and layout variant resolution, kept layout/menu/page event contracts unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 521: rescanned `AppMainContent.vue` after contract extraction, consolidated the explicit `AppPageOutlet` input bindings into a typed `pageOutletProps` computed using `AppPageOutletProps`, kept all page outlet event forwarding unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 522: replaced the long inline sidebar/page event forwarding lists in `AppMainContent.vue` with explicit typed `sidebarOutletListeners` and `pageOutletListeners` maps, kept all event names and arguments visible in script, simplified the template to layout plus outlet bindings, and passed `npx vue-tsc --noEmit`.
- Completed Step 523: ran the post-central-layout rescan and confirmed this phase is complete: `AppLayout.vue` owns the shell/columns/resize handle, `AppMainContent.vue` now acts as the layout assembly layer with typed outlet props/listeners, and `AppPageOutlet.vue` acts as the state-driven page outlet dispatcher with branch-specific outlet wrappers. No further low-risk layout cleanup remains before high-risk components.
- Completed Step 524: wrote the high-risk-component refactor plan, selected `TrackTable.vue` as the first target because a contract-only cleanup can reduce risk without changing row behavior, and passed `npx vue-tsc --noEmit`.

## High-Risk Component Refactor Plan

Assumptions:
- `TrackTable.vue`, `PlayerDock.vue`, `LyricsView.vue`, and `DiscoverMusicPage.vue` are shared behavior surfaces; changes here must preserve event contracts and user workflows exactly.
- Prefer contract/type cleanup and display-only extraction before moving lifecycle, playback, search, or scroll state.
- Page-owned and component-owned state must stay local unless a focused composable already exists or the new boundary has explicit inputs/outputs.

Success criteria for this phase:
- Each step updates this document after verification and passes `npx vue-tsc --noEmit`.
- `TrackTable.vue` keeps row click, context menu, paging, favorite/download actions, active/preparing row behavior, and expose methods unchanged.
- `DiscoverMusicPage.vue` keeps online search lifecycle (`searchReady`, `searchStarted`, `searchUpdated`) page-owned.
- `PlayerDock.vue` and `LyricsView.vue` are not split until their runtime/listener/visual checkpoints are written in this document.

Planned sequence:
- Step 524: write this high-risk plan and choose the first low-risk target.
- Completed Step 525: centralized `TrackTable.vue` props, emits, slots, row-class, and track-key contracts into `src/types/trackTable.ts`, updated `TrackTable.vue` to import those types, left rendering/row behavior/styles unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 526: rescanned `TrackTable.vue` after contract extraction, deferred `TrackTableRow` extraction because row rendering crosses scoped CSS, responsive column hiding, slots, and click/context-menu/action behavior, then safely merged duplicate wide-row hover CSS without changing the final visual rule and passed `npx vue-tsc --noEmit`.
- Completed Step 527: extracted row rendering into `TrackTableRow.vue` under the dedicated checkpoint, kept `TrackTable.vue` owning paging, active-row checks, row-state functions, labels, and interaction handlers, preserved the row root `button.track-row`, passed the DOM ref callback through for `scrollToTrack`, moved row-private extra-cell styles into the row component, fixed the initial ref/slot type-check feedback, and passed `npx vue-tsc --noEmit`.
- Completed Step 528: rescanned `TrackTable.vue` and `TrackTableRow.vue` after row extraction, simplified the row component's mobile hidden-column selector to remove an unused `has-number-column` branch while preserving the same hidden columns, confirmed deeper TrackTable cleanup would require visual/responsive verification, and passed `npx vue-tsc --noEmit`.
- Completed Step 529: wrote the `PlayerDock.vue` checkpoint, explicitly deferred playback runtime/listener movement until a separate checkpoint, selected contract typing as the first safe boundary, and passed `npx vue-tsc --noEmit`.

## PlayerDock Refactor Checkpoint

Assumptions:
- `PlayerDock.vue` coordinates live playback runtime, queue controls, sleep timer, progress, quality/lyric format controls, and active-track metadata; runtime state must not move casually.
- The first safe boundary is props/emits typing because it does not change playback behavior.
- Any later runtime split must preserve `requestInitialPlayback`, `playbackStateChange`, `seamlessAdvance`, `spectrumChange`, seek request handling, restore request handling, and sleep timer stop/exit behavior.

Success criteria:
- Contract-only steps do not alter template structure, runtime composable wiring, refs, or sleep timer flow.
- Each PlayerDock step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Display-only extraction may touch template/components; runtime/listener extraction requires a separate checkpoint entry first.

Planned sequence:
- Step 529: write this checkpoint and verify the current tree.
- Completed Step 530: centralized `PlayerDock.vue` props and emits into `src/types/playerDock.ts`, updated `PlayerDock.vue` to import `PlayerDockProps` and `PlayerDockEmits`, left playback runtime composable wiring, template structure, refs, sleep timer flow, and styles unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 531: grouped the `PlaybackMetaControls` input props in `PlayerDock.vue` into a typed `playbackMetaControlProps` computed using `PlaybackMetaControlProps`, kept all meta-control events explicit in the template, left playback runtime/listener wiring unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 532: grouped the display-only `NowPlayingInfo` and `TransportControls` input props in `PlayerDock.vue` into typed `nowPlayingInfoProps` and `transportControlProps` computed bindings, kept cover/open-lyrics and transport events explicit in the template, left playback runtime/listener wiring unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 533: ran the final `PlayerDock.vue` rescan after display-only prop grouping and stopped before runtime/listener changes because remaining complexity is live playback runtime, progress, queue, sleep timer, restore/seek requests, and backend listener behavior; deeper PlayerDock runtime extraction now requires a separate checkpoint and behavioral verification plan.
- Completed Step 534: wrote the `LyricsView.vue` checkpoint, explicitly deferred lyrics loading/search/cover/scroll/association/fullscreen/action-menu state movement until separate behavior checkpoints, selected contract typing as the first safe boundary, and passed `npx vue-tsc --noEmit`.

## LyricsView Refactor Checkpoint

Assumptions:
- `LyricsView.vue` coordinates lyrics loading, cover loading, highlighting, scroll, fullscreen, action menu, download, association, and plugin search; behavior changes here are user-visible and must be staged.
- The first safe boundary is props/emits typing because it does not change rendering, composable order, or lifecycle behavior.
- Any later extraction of `LyricsStage`, action menu, or search dialog props should keep `useLyricsTrackLoader`, `useLyricsScroll`, `useLyricsAssociation`, and `useLyricsSearch` ownership in `LyricsView.vue` until a deeper checkpoint is written.

Success criteria:
- Contract-only steps leave loaded lyric lines, loading flags, composable wiring, search lifecycle, cover cache, scroll sync, and emits unchanged.
- Each LyricsView step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving lyrics loading/search/scroll state requires a separate behavior checkpoint first.

Planned sequence:
- Step 534: write this checkpoint and verify the current tree.
- Completed Step 535: centralized `LyricsView.vue` props, status type, and emits into `src/types/lyricsView.ts`, updated `LyricsView.vue` to import `LyricsViewProps` and `LyricsViewEmits`, left loaded lyric lines, loading flags, composable wiring, search lifecycle, cover cache, scroll sync, template structure, and styles unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 536: grouped the display-only `LyricsStage` input props in `LyricsView.vue` into a typed `lyricsStageProps` computed using `LyricsStageProps`, kept stage events explicit in the template, left lyrics loading/search/scroll state ownership untouched, and passed `npx vue-tsc --noEmit`.
- Completed Step 537: grouped `LyricsActionMenuOverlay` and `LyricsSearchDialogOverlay` input props in `LyricsView.vue` into typed `lyricsActionMenuProps` and `lyricsSearchDialogProps` computed bindings, kept menu/search events explicit in the template, left lyrics search/action state ownership untouched, and passed `npx vue-tsc --noEmit`.
- Completed Step 538: ran the final `LyricsView.vue` rescan after display prop grouping and stopped before lifecycle/state movement because remaining complexity is lyrics loading, cover cache, scroll sync, association, fullscreen, action menu, and plugin search behavior; deeper LyricsView extraction now requires a separate behavior-specific checkpoint and workflow verification plan.

## DiscoverMusicPage Refactor Checkpoint

Assumptions:
- `DiscoverMusicPage.vue` owns online-search page state: search query, providers, results, load-more state, search history, and snapshot synchronization.
- `searchReady`, `searchStarted`, and `searchUpdated` are page lifecycle events and must remain explicit unless a deeper behavior checkpoint is written.
- The first safe boundary is props/emits typing because it does not change search behavior, provider selection, or result rendering.

Success criteria:
- Contract-only steps leave `useOnlineSearch`, `useSearchHistory`, watches, mounted snapshot emission, and search/clear/retry functions unchanged.
- Each DiscoverMusicPage step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving search lifecycle or snapshot bridge behavior requires a separate checkpoint first.

Planned sequence:
- Completed Step 539: wrote the `DiscoverMusicPage.vue` checkpoint, explicitly kept online search query/providers/results/load-more/search-history/snapshot synchronization page-owned, selected contract typing as the first safe boundary, and passed `npx vue-tsc --noEmit`.
- Completed Step 540: centralized `DiscoverMusicPage.vue` props and emits into `src/types/discoverMusicPage.ts`, updated `DiscoverMusicPage.vue` to import `DiscoverMusicPageProps` and `DiscoverMusicPageEmits`, removed the now-unused local `Track` type import after type-check feedback, left `useOnlineSearch`, `useSearchHistory`, watches, mounted snapshot emission, search/clear/retry functions, and template behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 541: grouped `PluginSearchView` input props in `DiscoverMusicPage.vue` into a typed `pluginSearchViewProps` computed using shared `PluginSearchViewProps`, updated `PluginSearchView.vue` to reuse that props contract, kept search/load-more/provider/menu/play/download/favorite events explicit, removed an unused provider type import after type-check feedback, left online search lifecycle and snapshot synchronization page-owned, and passed `npx vue-tsc --noEmit`.
- Completed Step 542: ran the final `DiscoverMusicPage.vue` rescan after display prop grouping and stopped before online search lifecycle/snapshot movement because remaining complexity is page-owned search query, provider/result/load-more state, search history, mounted snapshot emission, and watch-based `searchUpdated` synchronization; deeper Discover extraction now requires a behavior-specific checkpoint and workflow verification plan.

## App.vue Root Orchestration Checkpoint

Assumptions:
- `App.vue` is the root orchestration layer for application bootstrap, navigation, playback, lyrics, downloads, context menus, dialogs, tray/window events, and backend queue synchronization.
- It should not keep growing template prop lists when child components already expose typed props contracts.
- Do not move root-owned business state or lifecycle behavior without a dedicated behavior checkpoint.

Success criteria:
- Low-risk steps may group child props/listeners with existing typed contracts, but must leave composable wiring, event handlers, and root state ownership unchanged.
- Each root orchestration step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving playback, lyrics, navigation, tray, bootstrap, or backend queue behavior out of `App.vue` requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 543: wrote the `App.vue` root orchestration checkpoint, explicitly deferred root-owned playback/lyrics/navigation/tray/bootstrap/backend queue behavior movement until separate behavior checkpoints, selected typed child prop grouping as the first safe boundary, and passed `npx vue-tsc --noEmit`.
- Completed Step 544: grouped the long `AppMainContent` input prop list in `App.vue` into a typed `appMainContentProps` computed using `AppMainContentProps`, kept all `AppMainContent` events explicit in the root template, left root composable wiring and business state ownership unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 545: grouped the `PlayerDock` input prop list in `App.vue` into a typed `playerDockProps` computed using `PlayerDockProps`, kept all playback/lyrics/queue/sleep-timer events explicit in the root template, left root playback state and runtime wiring unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 546: grouped the `LyricsView` input prop list in `App.vue` into a typed `lyricsViewProps` computed using `LyricsViewProps`, kept all lyrics close/cover/lyrics/notify/dock/seek events explicit in the root template, fixed the script-side `lyricsViewState.value.error` ref access after type-check feedback, left root lyrics state and lifecycle wiring unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 547: centralized `AppDialogs.vue` props/emits contract into `src/types/appDialogs.ts`, grouped `AppDialogs` input props in `App.vue` through a typed computed binding, kept dialog events explicit in the root template, left dialog state ownership unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 548: centralized root context-menu prop contracts into `src/types/appContextMenus.ts`, updated `PlaylistContextMenu.vue` and `TrackContextMenu.vue` to reuse those contracts, grouped both menu input prop sets in `App.vue` through typed computed bindings, kept menu events and state ownership explicit, and passed `npx vue-tsc --noEmit`.
- Completed Step 549: grouped the long `AppMainContent` event list in `App.vue` into a typed `AppMainContentListeners` map, kept page-owned state and root handlers unchanged, removed the long inline event block from the root template, and passed `npx vue-tsc --noEmit`.
- Completed Step 550: grouped the long `AppDialogs` event list in `App.vue` into a typed `AppDialogsListeners` map, kept dialog state ownership and root handlers unchanged, removed the long inline dialog event block from the root template, and passed `npx vue-tsc --noEmit`.
- Completed Step 551: grouped the `LyricsView` event list in `App.vue` into a typed `LyricsViewListeners` map, named the active-track cover refresh handler, kept lyrics state, transitions, and root handlers unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 552: grouped the `PlayerDock` event list in `App.vue` into a typed `PlayerDockListeners` map, named the playback running-state, spectrum, and time update handlers, kept playback runtime, queue, lyrics dock hover state, and root handlers unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 553: rescanned `App.vue` after prop/listener grouping, confirmed the remaining root complexity is mostly composable orchestration plus two context-menu event blocks, selected context-menu listener grouping as the next safe cleanup, and passed `npx vue-tsc --noEmit`.
- Completed Step 554: grouped `PlaylistContextMenu` and `TrackContextMenu` event lists in `App.vue` into typed listener maps, kept context-menu state and root handlers unchanged, removed the remaining long inline context-menu event blocks from the root template, and passed `npx vue-tsc --noEmit`.
- Completed Step 555: performed a broader frontend architecture scan after root template cleanup, found remaining high-risk areas in playback/lyrics/bootstrap/tray composable orchestration, selected root-owned UI fragments (`AppStartupLoading` / online toast) as the next safe component cleanup, and passed `npx vue-tsc --noEmit`.
- Completed Step 556: extracted the root startup loading markup and private styles from `App.vue` into `AppStartupLoading.vue`, kept readiness state and loading text ownership in `App.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 557: extracted the root online toast markup, transition, and private styles from `App.vue` into `AppOnlineToast.vue`, kept toast state ownership in `App.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 558: rescanned `App.vue` scoped styles after root UI extraction, confirmed the remaining `.library-resize-handle` media rule was duplicated in `AppLayout.vue` and ineffective across scoped boundaries, removed the now-empty root style block, and passed `npx vue-tsc --noEmit`.
- Completed Step 559: extracted the remaining lyrics dock hot-zone fragment into `LyricsDockHotZone.vue`, kept auto-hide timing and hover state ownership in `App.vue` / `useLyricsDockAutoHide`, and passed `npx vue-tsc --noEmit`.
- Completed Step 560: rescanned `App.vue` after root UI fragment extraction, confirmed the root template is now mostly shell/outlet/overlay composition and deeper root changes would touch playback/bootstrap/tray/backend behavior, selected `AppPageOutlet.vue` typed prop/listener grouping as the next safe page-dispatch cleanup, and passed `npx vue-tsc --noEmit`.
- Completed Step 561: added the `AppPageOutlet.vue` cleanup checkpoint, set page-dispatch prop/listener grouping as the first safe boundary, explicitly kept page-owned state and page behavior in existing page components, and passed `npx vue-tsc --noEmit`.

## AppPageOutlet Refactor Checkpoint

Assumptions:
- `AppPageOutlet.vue` is a state-driven page dispatcher, not a Vue Router boundary in this pass.
- Individual pages keep owning their own state and lifecycle; the dispatcher should only select the active page and forward typed inputs/events.
- The first safe boundary is grouping child outlet props/listeners because it does not change active-view branching or page behavior.

Success criteria:
- Page outlet cleanup preserves existing `activeView` / collection branching and all emitted events.
- Each `AppPageOutlet.vue` step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving page state, search lifecycle, downloads behavior, or navigation semantics requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 561: write this checkpoint and verify the current tree.
- Completed Step 562: grouped `AppLibraryHomePageOutlet` props/listeners in `AppPageOutlet.vue` into typed computed/listener maps, centralized the library-home outlet contract in `src/types/appPageOutlet.ts`, kept library page state and events unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 563: grouped `AppDiscoverPageOutlet` props/listeners in `AppPageOutlet.vue` into typed computed/listener maps, centralized the discover outlet contract in `src/types/appPageOutlet.ts`, preserved `searchReady` / `searchUpdated` forwarding to `onlineSearchUpdated`, kept discover search lifecycle page-owned, and passed `npx vue-tsc --noEmit`.
- Completed Step 564: grouped `AppWorkspacePageOutlet` props/listeners in `AppPageOutlet.vue` into typed computed/listener maps, centralized the workspace outlet contract in `src/types/appPageOutlet.ts`, preserved the existing workspace `play-visible-tracks` to `playFavoriteTracks` forwarding inside the child outlet, and passed `npx vue-tsc --noEmit`.
- Completed Step 565: grouped `AppArtistsPageOutlet` props/listeners in `AppPageOutlet.vue` into typed computed/listener maps, centralized the artists outlet contract in `src/types/appPageOutlet.ts`, kept artists page state and selection behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 566: grouped `AppDownloadsPageOutlet` props/listeners in `AppPageOutlet.vue` into typed computed/listener maps, centralized the downloads outlet contract in `src/types/appPageOutlet.ts`, kept download state and actions owned by the existing download controller/page flow, and passed `npx vue-tsc --noEmit`.
- Completed Step 567: grouped `AppUtilityPageOutlet` props/listeners in `AppPageOutlet.vue` into typed computed/listener maps, centralized the utility outlet contract in `src/types/appPageOutlet.ts`, made all page-dispatch branches use the same `v-bind` / `v-on` typed-map pattern, and passed `npx vue-tsc --noEmit`.
- Completed Step 568: rescanned `AppPageOutlet.vue` after all child outlet prop/listener grouping, confirmed the template is now a thin state-driven dispatcher, kept the typed maps local instead of introducing a single-use composable, and passed `npx vue-tsc --noEmit`.
- Completed Step 569: rescanned child page outlet components, found `AppLibraryHomePageOutlet.vue` and `AppDiscoverPageOutlet.vue` still contain long pure-forwarding templates while `AppPageOutlet.vue` itself is already thin, chose `AppLibraryHomePageOutlet.vue` as the next safe cleanup, and passed `npx vue-tsc --noEmit`.
- Completed Step 570: replaced `AppLibraryHomePageOutlet.vue` long prop/event forwarding with a typed props binding and listener map, kept `LibraryHomePage` state and behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 571: replaced `AppDiscoverPageOutlet.vue` long prop/event forwarding with a typed props binding and listener map, kept `DiscoverMusicPage` search state and lifecycle unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 572: rescanned remaining child page outlets, found `AppArtistsPageOutlet.vue` and `AppDownloadsPageOutlet.vue` are pure pass-through candidates, kept `AppWorkspacePageOutlet.vue` explicit because it derives `preparingTrackId` and playlist mode locally, and kept `AppUtilityPageOutlet.vue` explicit because it dispatches among utility pages; passed `npx vue-tsc --noEmit`.
- Completed Step 573: replaced pure pass-through forwarding in `AppArtistsPageOutlet.vue` and `AppDownloadsPageOutlet.vue` with typed props bindings and listener maps, kept artists/download state ownership unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 574: rescanned child page outlets after pass-through cleanup, confirmed `AppWorkspacePageOutlet.vue` should keep explicit derived `preparingTrackId` and playlist-mode bindings, found only `AppUtilityPageOutlet.vue` has a small remaining notify forwarding cleanup, and passed `npx vue-tsc --noEmit`.
- Completed Step 575: replaced the inline plugin notify forwarding in `AppUtilityPageOutlet.vue` with a typed listener map, kept utility-page dispatch explicit, and passed `npx vue-tsc --noEmit`.
- Completed Step 576: ran a final page-outlet cleanup rescan, confirmed the outlet layer is now thin and type-checked, identified `PluginManagerView.vue` as the next worthwhile page-owned cleanup area because it remains large while avoiding playback/lyrics runtime behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 577: wrote the `PluginManagerView.vue` checkpoint, scanned its internal structure and existing `plugin-manager/*` subcomponents, found the page is already componentized but still has large panel prop/event bindings, selected typed panel prop/listener grouping as the first safe cleanup, and passed `npx vue-tsc --noEmit`.

## PluginManagerView Refactor Checkpoint

Assumptions:
- `PluginManagerView.vue` owns plugin center page state: active tab, catalog/plugin rows, market selection, installation actions, drag sorting, subscriptions, and lifecycle refresh.
- Existing `plugin-manager/*` components already own most display structure; do not move plugin install/subscription/market lifecycle behavior in this pass.
- The first safe boundary is grouping panel props/listeners in `PluginManagerView.vue` because it does not change plugin actions or state ownership.

Success criteria:
- Panel prop/listener grouping keeps active tab branching, plugin state, install actions, drag actions, subscription actions, and lifecycle hooks unchanged.
- Each PluginManagerView step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving plugin catalog, install, market, drag, or subscription state requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 577: write this checkpoint and verify the current tree.
- Completed Step 578: grouped `PluginMarketPanel` props/listeners in `PluginManagerView.vue` into typed computed/listener maps, centralized the market panel contract in `src/types/pluginManager.ts`, replaced inline `v-model` with explicit typed update listeners, kept market state and actions page-owned, and passed `npx vue-tsc --noEmit`.
- Completed Step 579: grouped `PluginInstalledPanel` props/listeners in `PluginManagerView.vue` into typed computed/listener maps, centralized the installed panel contract in `src/types/pluginManager.ts`, kept install, selection, and drag state page-owned, and passed `npx vue-tsc --noEmit`.
- Completed Step 580: grouped `PluginSubscriptionsPanel` props/listeners in `PluginManagerView.vue` into typed computed/listener maps, centralized the subscriptions panel contract in `src/types/pluginManager.ts`, replaced inline `v-model` with an explicit typed update listener, kept subscription state/actions page-owned, and passed `npx vue-tsc --noEmit`.
- Completed Step 581: rescanned `PluginManagerView.vue` after panel binding cleanup, confirmed the template is now mostly header/tabs/panel/overlay composition, stopped before moving plugin catalog/install/market/drag/subscription lifecycle behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 582: performed a final architecture status pass across `App.vue`, the outlet layer, and plugin manager cleanup, confirmed the remaining high-risk areas are playback/lyrics/plugin lifecycle behavior, selected `TrackCoverEqualizer.vue` as the next safe visual-component checkpoint, and passed `npx vue-tsc --noEmit`.
- Completed Step 583: wrote the `TrackCoverEqualizer.vue` visual-component checkpoint, scanned the component and usages, found visual bar calculation and debug watch mixed in one component, selected props/style contract typing as the first safe cleanup before any logic extraction, and passed `npx vue-tsc --noEmit`.

## TrackCoverEqualizer Refactor Checkpoint

Assumptions:
- `TrackCoverEqualizer.vue` is a visual component for cover playback/loading indication; playback state and spectrum input stay owned by parent playback/list components.
- The debug watch is observational and should not be moved or removed casually without a dedicated decision.
- The first safe boundary is props/style typing because it does not change animation, debug output, or rendered DOM.

Success criteria:
- Contract-only steps preserve bar count, loading animation, paused/playing classes, spectrum scaling, and debug watch behavior.
- Each TrackCoverEqualizer step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving spectrum calculation or debug behavior requires a separate visual/behavior checkpoint first.

Planned sequence:
- Completed Step 583: write this checkpoint and verify the current tree.
- Completed Step 584: centralized `TrackCoverEqualizer.vue` props and bar style types in `src/types/trackCoverEqualizer.ts`, kept rendered DOM, spectrum scaling, debug watch, and animation behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 585: extracted the equalizer bar style calculation into pure helper functions inside `TrackCoverEqualizer.vue`, kept computed ownership, debug watch, rendered DOM, and animation behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 586: rescanned `TrackCoverEqualizer.vue` after helper extraction, kept private CSS animations in the component, stopped before changing or moving the debug watch because that is a behavior decision, and passed `npx vue-tsc --noEmit`.
- Completed Step 587: scanned remaining medium-sized display components, avoided playback/lyrics/plugin lifecycle areas, identified `AppLayout.vue` resize-handle markup/styles as the next safe layout-container extraction target, and passed `npx vue-tsc --noEmit`.
- Completed Step 588: extracted the `AppLayout.vue` resize handle into `AppLayoutResizeHandle.vue`, moved handle-private styles and mobile hiding with it, kept layout grid state and resize behavior owned by `AppLayout` / parent composable, and passed `npx vue-tsc --noEmit`.
- Completed Step 589: rescanned `AppLayout.vue` after resize-handle extraction, confirmed it now owns only grid/container rules and slot composition, kept layout CSS in the layout container, fixed the new resize handle label to stable ASCII, and passed `npx vue-tsc --noEmit`.
- Completed Step 590: performed a fresh architecture scan, avoided root/playback/lyrics behavior movement, identified `ThemeView.vue` as the next page-local cleanup target because its `LocalThemeGrid` binding remains long while theme import/delete state is page-owned, and passed `npx vue-tsc --noEmit`.
- Completed Step 591: wrote the `ThemeView.vue` checkpoint, selected `LocalThemeGrid` props/listener grouping as the first safe boundary, kept theme import/delete/select behavior page-owned, and passed `npx vue-tsc --noEmit`.

## ThemeView Refactor Checkpoint

Assumptions:
- `ThemeView.vue` owns theme page behavior: selecting themes, importing custom themes, resolving custom preview paths/styles, and uninstalling related theme plugins.
- `LocalThemeGrid` is display/control composition and can receive a typed prop/listener map without moving theme behavior.
- The first safe boundary is binding cleanup because it does not change theme persistence or plugin uninstall behavior.

Success criteria:
- Theme cleanup preserves local/custom theme lists, selected theme, import dialog flow, custom preview conversion, custom preview styles, and custom theme removal behavior.
- Each ThemeView step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving import/delete/plugin matching behavior requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 591: write this checkpoint and verify the current tree.
- Completed Step 592: grouped `LocalThemeGrid` props/listeners in `ThemeView.vue` into typed computed/listener maps, centralized the grid contract in `src/components/theme/types.ts`, preserved theme import/delete/select behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 593: rescanned `ThemeView.vue` after grid binding cleanup, confirmed the template is now thin and the remaining complexity is import/delete/plugin-theme matching behavior, stopped before behavior movement, and passed `npx vue-tsc --noEmit`.
- Completed Step 594: performed another safe-target scan, avoided behavior-heavy playback/lyrics/plugin/theme flows, identified `WorkspaceView.vue` as the next page-local composition cleanup target because its `WorkspaceTrackList` binding remains long while workspace state stays page-owned, and passed `npx vue-tsc --noEmit`.
- Completed Step 595: wrote the `WorkspaceView.vue` checkpoint, selected `WorkspaceTrackList` props/listener grouping as the first safe boundary, kept search, hero actions, track list ref, and active-track locating behavior page-owned, and passed `npx vue-tsc --noEmit`.

## WorkspaceView Refactor Checkpoint

Assumptions:
- `WorkspaceView.vue` owns workspace page composition: search toolbar, collection hero actions, active-track locating, and track-list event forwarding.
- `WorkspaceTrackList` remains the track-list display/scroll component; moving `trackListRef` or locate behavior requires a behavior checkpoint.
- The first safe boundary is `WorkspaceTrackList` props/listener grouping because it does not change search, hero, or list behavior.

Success criteria:
- Workspace cleanup preserves search update, play all/visible/favorites branching, locate active track, track menu, play/select/favorite events, and empty/error display.
- Each WorkspaceView step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving active-track locating, search state, or collection display behavior requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 595: write this checkpoint and verify the current tree.
- Completed Step 596: grouped `WorkspaceTrackList` props/listeners in `WorkspaceView.vue` into typed computed/listener maps, centralized the track-list contract in `src/types/workspace.ts`, preserved search, hero actions, track list ref, scroll locating, and track-list behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 597: rescanned `WorkspaceView.vue` after track-list binding cleanup, kept search toolbar and collection hero bindings explicit because they encode page actions (`update:modelValue`, play visible/favorites, locate active track), and passed `npx vue-tsc --noEmit`.
- Completed Step 598: scanned artists page components, kept `ArtistListPanel.vue` scrolling/selected-row state local, selected `ArtistsView.vue` -> `ArtistTrackList` binding cleanup as the next safe page-local target, and passed `npx vue-tsc --noEmit`.
- Completed Step 599: wrote the `ArtistsView.vue` checkpoint, selected `ArtistTrackList` props/listener grouping as the first safe boundary, kept artist selection, search input, selected artist derivation, and panel scrolling behavior in their current owners, and passed `npx vue-tsc --noEmit`.

## ArtistsView Refactor Checkpoint

Assumptions:
- `ArtistsView.vue` owns artists page composition: artist panel, search toolbar, selected artist display, and selected artist track-list forwarding.
- `ArtistListPanel.vue` owns artist list scrolling and selected-row positioning; do not move it in this pass.
- The first safe boundary is `ArtistTrackList` props/listener grouping because it does not change artist selection or list scrolling behavior.

Success criteria:
- Artists cleanup preserves artist selection, search update, selected artist fallback, hero title/count, track menu, play/select/favorite events, and artist panel scroll-to-selected behavior.
- Each ArtistsView step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving selected artist derivation or panel scrolling behavior requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 599: write this checkpoint and verify the current tree.
- Completed Step 600: grouped `ArtistTrackList` props/listeners in `ArtistsView.vue` into typed computed/listener maps, centralized the artist track-list contract in `src/types/artists.ts`, preserved artist selection/search/fallback/hero behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 601: ran a final architecture scan for this continuation, confirmed the largest remaining components are mostly playback/lyrics/plugin/runtime behavior-heavy or already checkpointed, selected `LibraryPanel.vue` binding cleanup as one more low-risk layout/menu target, and passed `npx vue-tsc --noEmit`.

## LibraryPanel Refactor Checkpoint

Assumptions:
- `LibraryHomePage.vue` owns the library page composition and forwards page actions from the left library panel and right workspace detail area.
- `LibraryPanel.vue` is the left library menu/panel display component; it should not own navigation state beyond reflecting selected collection/filter/folder inputs.
- The first safe boundary is grouping `LibraryPanel` props/listeners in `LibraryHomePage.vue` and centralizing the panel contract because it does not change menu behavior or page state ownership.

Success criteria:
- Library panel cleanup preserves all-songs, recent-added, folder selection, scan-dialog, online-search selected-state, and visible/recent count display behavior.
- Each LibraryPanel step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving library navigation state or scan/folder behavior requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 602: centralized `LibraryPanel` props/emits/listener types in `src/types/library.ts`, grouped the left library menu panel binding in `LibraryHomePage.vue`, kept all-songs/recent/folder/scan actions page-owned, and passed `npx vue-tsc --noEmit`.
- Completed Step 603: centralized `WorkspaceView` props/emits/listener types in `src/types/workspace.ts`, grouped the `WorkspaceView` bindings in both `LibraryHomePage.vue` and `AppWorkspacePageOutlet.vue`, preserved the existing `play-visible-tracks` to favorites playback forwarding and derived `preparingTrackId` / playlist-mode behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 604: centralized primary sidebar and sidebar navigation props/emits/listener contracts in `src/types/sidebar.ts`, grouped the `PrimarySidebar.vue` to `SidebarNav.vue` binding, switched `SidebarNav.vue` to shared types, preserved state-driven menu navigation without introducing Vue Router, and passed `npx vue-tsc --noEmit`.
- Completed Step 605: added `AppSidebarOutlet` contracts in `src/types/sidebar.ts`, grouped `AppSidebarOutlet.vue` to `PrimarySidebar.vue` props/listeners, preserved the existing library-panel recent-added highlight override, kept navigation state outside the sidebar components, and passed `npx vue-tsc --noEmit`.
- Completed Step 606: ran a fresh architecture scan after library/sidebar binding cleanup, avoided playback/lyrics/plugin lifecycle and routing semantics, selected `DownloadManagerView.vue` content binding cleanup as the next page-local low-risk target, and passed `npx vue-tsc --noEmit`.

## DownloadManagerView Refactor Checkpoint

Assumptions:
- `DownloadManagerView.vue` owns download page-local UI state: active tab and the open download-item context menu.
- Download actions remain emitted upward to the existing download controller/page outlet; this pass should not move download lifecycle behavior.
- The first safe boundary is grouping `DownloadManagerContent` props/listeners because it only forwards visible tracks, row helpers, and track events.

Success criteria:
- Download cleanup preserves downloaded/downloading tab selection, context-menu opening/closing, row context-open class, empty messages, track play/select/favorite events, and all download item menu actions.
- Each DownloadManagerView step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving download queue, retry/pause/resume/delete behavior, or tab/context-menu state requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 607: centralized `DownloadManagerContent` props/emits/listener types in `src/types/downloadManager.ts`, grouped its binding in `DownloadManagerView.vue`, kept active tab, visible-track derivation, context-menu state, row class, and download actions unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 608: centralized `DownloadItemContextMenu` props/emits/listener types in `src/types/downloadManager.ts`, typed the download context-menu state in `DownloadManagerView.vue`, grouped menu action listeners through a typed map, kept `emitMenuAction` and close-after-action behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 609: centralized `DownloadManagerView` props/emits/listener contracts in `src/types/downloadManager.ts`, made `DownloadManagerView.vue` and `AppDownloadsPageOutlet.vue` reuse that dedicated download-page contract, slimmed the downloads section of `src/types/appPageOutlet.ts` to aliases, kept download tab/context-menu/action behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 610: ran a final continuation scan after download cleanup, confirmed remaining largest components are mostly playback/lyrics/plugin/table/window behavior-heavy, selected `TrackMetadataDialog.vue` top-level contract centralization as one more low-risk dialog target, and passed `npx vue-tsc --noEmit`.

## TrackMetadataDialog Refactor Checkpoint

Assumptions:
- `TrackMetadataDialog.vue` owns metadata dialog behavior: form reset, cover preview loading, audio info loading, display labels, and save submission gating.
- Dialog lifecycle behavior should stay inside the dialog/composables in this pass; parent dialogs only mount it and receive close/save events.
- The first safe boundary is centralizing the top-level props/emits contract because it does not change form state, loading, preview, or save behavior.

Success criteria:
- Metadata dialog cleanup preserves track prop handling, saving/error display, locale labels, form reset on track change, cover/audio loading cleanup on unmount, and save payload behavior.
- Each TrackMetadataDialog step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving metadata form, cover preview, audio info, or save lifecycle behavior requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 611: centralized `TrackMetadataDialog` props/emits types in `src/types/trackMetadataDialog.ts`, updated `TrackMetadataDialog.vue` to use the shared contract, kept form reset, cover preview loading, audio info loading, unmount cleanup, saving/error display, and save payload behavior unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 612: ran final verification and architecture scan after metadata dialog contract cleanup, confirmed `npx vue-tsc --noEmit` passes, and documented that the largest remaining components are mostly playback, lyrics, plugin, table, or window lifecycle behavior-heavy boundaries.

## BaseDialog Refactor Checkpoint

Assumptions:
- `BaseDialog.vue` is a reusable shell component for modal layout, overlay click handling, close button state, and CSS variable driven sizing.
- It should expose a clear shared contract, but it should not know about feature-specific dialog state or save/import/delete behavior.
- The first safe boundary is centralizing the base dialog props/emits type because it does not change overlay click behavior, slot structure, or styles.

Success criteria:
- Base dialog cleanup preserves close labels, disabled close behavior, optional overlay close, sizing/layout CSS variables, z-index, slots, and emitted close event.
- Each BaseDialog step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving feature-specific dialog behavior into `BaseDialog.vue` is out of scope.

Planned sequence:
- Completed Step 613: centralized `BaseDialog` props/emits types in `src/types/baseDialog.ts`, updated `BaseDialog.vue` to use the shared contract, preserved defaults, overlay close behavior, slot structure, CSS variable sizing, close button behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 614: rescanned base menu/table candidates, deferred `TrackTableRow.vue` and table internals because they are tied to row interaction/paging behavior, selected `BaseContextMenu.vue` public contract centralization as the next low-risk shell-component cleanup, and passed `npx vue-tsc --noEmit`.

## BaseContextMenu Refactor Checkpoint

Assumptions:
- `BaseContextMenu.vue` owns reusable context-menu positioning, viewport clamping, resize repositioning, and slot rendering.
- Feature-specific menu actions should stay in caller-specific menu components.
- The first safe boundary is centralizing the shell props type because it does not change positioning or event handling behavior.

Success criteria:
- Base context-menu cleanup preserves x/y positioning, min width, z-index, viewport clamping, resize listener setup/cleanup, click/contextmenu stop behavior, and slot rendering.
- Each BaseContextMenu step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving feature menu action behavior into `BaseContextMenu.vue` is out of scope.

Planned sequence:
- Completed Step 615: centralized `BaseContextMenu` props type in `src/types/baseContextMenu.ts`, updated `BaseContextMenu.vue` to use the shared contract, preserved viewport clamping, resize listener lifecycle, click/contextmenu stop behavior, slot rendering, defaults, and passed `npx vue-tsc --noEmit`.
- Completed Step 616: ran final verification after `BaseContextMenu` cleanup, confirmed `npx vue-tsc --noEmit` passes, and summarized that remaining large boundaries should be handled through dedicated behavior checkpoints rather than opportunistic movement.

## Sidebar Main Links Refactor Checkpoint

Assumptions:
- `SidebarMainNavLinks.vue` is a presentational/state-reflecting slice of the state-driven sidebar menu.
- It should not own navigation state or introduce Vue Router in this pass; it only displays active state and emits menu intents.
- The first safe boundary is centralizing its props/emits/listener contract and grouping the parent binding in `SidebarNav.vue`.

Success criteria:
- Main sidebar links cleanup preserves discover/library/artists/recent/downloads/plugins visibility, active-state checks, titles, icons, and emitted navigation events.
- Each sidebar main-links step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Changing routing semantics or moving navigation state requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 617: centralized `SidebarMainNavLinks` props/emits/listener types in `src/types/sidebar.ts`, updated `SidebarMainNavLinks.vue` to use the shared contract, grouped its binding in `SidebarNav.vue`, preserved state-driven menu active checks, visibility rules, icons/titles, navigation emits, and passed `npx vue-tsc --noEmit`.
- Completed Step 618: rescanned sidebar child components, kept playlist-list scroll visibility state local, selected `SidebarPlaylistNavList.vue` contract centralization as a safe cleanup, and passed `npx vue-tsc --noEmit`.
- Completed Step 619: centralized `SidebarPlaylistNavList` props/emits/listener types in `src/types/sidebar.ts`, updated `SidebarPlaylistNavList.vue` to use the shared contract, grouped its binding in `SidebarNav.vue`, kept playlist scroll visibility state local and playlist navigation/context-menu emits unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 620: ran final sidebar rescan and verification, confirmed `npx vue-tsc --noEmit` passes, and found only small presentational sidebar controls remain safe before stopping at navigation/state behavior boundaries.
- Completed Step 621: centralized `SidebarPlaylistCreateControl` and `SidebarFavoritesNavLink` props/emits/listener types in `src/types/sidebar.ts`, updated both presentational controls to use shared contracts, grouped their bindings in `SidebarNav.vue`, preserved create-playlist and favorites navigation emits, and passed `npx vue-tsc --noEmit`.
- Completed Step 622: ran final verification after sidebar small-control cleanup, confirmed `npx vue-tsc --noEmit` passes, and identified the next meaningful work as dedicated behavior checkpoints for `TrackTable`/row interactions, playback dock/runtime, lyrics/runtime, plugin lifecycle, or desktop window behavior rather than more opportunistic binding cleanup.

## TrackTable Refactor Checkpoint

Assumptions:
- `TrackTable.vue` owns reusable table behavior: active-row detection, paging/row refs, row state derivation, row click/context-menu handling, labels, and table layout classes.
- `TrackTableRow.vue` is a row display/control component; it should receive a clear row contract and emit row intents upward without owning table paging or selection behavior.
- The first safe boundary is centralizing `TrackTableRow` props/emits/slots/listener types and grouping row binding in `TrackTable.vue` because it does not change row DOM, paging, or interaction behavior.

Success criteria:
- Track table cleanup preserves active/preparing row state, internal paging, row refs, artist links, context-menu gating, download/favorite actions, extra columns/slots, track numbers/covers, labels, and responsive table CSS.
- Each TrackTable step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving paging, interaction handlers, row state derivation, or table layout CSS requires a separate behavior checkpoint first.

Planned sequence:
- Completed Step 623: centralized `TrackTableRow` props/emits/slots/listener types in `src/types/trackTable.ts`, updated `TrackTableRow.vue` to use the shared row contract, grouped row props/listeners in `TrackTable.vue` through `getTrackTableRowProps` and `trackTableRowListeners`, kept active-row detection, paging refs, click/context-menu handling, artist/download/favorite actions, extra slots, labels, and layout CSS unchanged, fixed computed label `.value` access from type-check feedback, and passed `npx vue-tsc --noEmit`.
- Completed Step 624: rescanned `TrackTable.vue` after row binding cleanup, kept paging/interaction/row-state composables in place, selected `TrackTableHeader.vue` contract centralization as another safe table-internal cleanup, and passed `npx vue-tsc --noEmit`.
- Completed Step 625: centralized `TrackTableHeader` props/slots types in `src/types/trackTable.ts`, updated `TrackTableHeader.vue` to use the shared contract, grouped header props in `TrackTable.vue` through `trackTableHeaderProps`, kept header DOM, extra-head slot, labels, download-action header behavior, and table layout CSS unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 626: rescanned `TrackTable.vue` after header/row contract cleanup, confirmed the remaining table component mostly coordinates composables and layout CSS, selected `TrackRowActions.vue` contract centralization as one final safe row-control cleanup before deeper behavior extraction, and passed `npx vue-tsc --noEmit`.
- Completed Step 627: centralized `TrackRowActions` props/emits/listener types in `src/types/trackTable.ts`, updated `TrackRowActions.vue` to use the shared contract, grouped its binding in `TrackTableRow.vue`, kept favorite/download button visibility, disabled/downloaded/pending state, stop-click behavior, and emitted track payloads unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 628: ran final TrackTable checkpoint scan and verification, confirmed `npx vue-tsc --noEmit` passes, and stopped before moving paging, row interaction handlers, row state derivation, or table layout CSS because those need dedicated behavior/layout checkpoints.

## App.vue Runtime Split Checkpoint

Assumptions:
- `App.vue` is still the root runtime orchestrator for playback, lyrics, downloads, scanning, navigation, dialogs, menus, tray/window behavior, backend queue sync, and child shell bindings.
- The first safe runtime-split boundary is extracting child binding construction because it does not move business ownership, lifecycle listeners, playback commands, queue sync, or page state.
- Do not introduce Vue Router in this checkpoint; navigation remains state-driven through the existing library navigation composable.

Success criteria:
- App runtime cleanup preserves all existing child props/listeners, root-owned state, backend calls, tray/window behavior, page state ownership, and menu/dialog behavior.
- Each App.vue runtime step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving playback, lyrics, downloads, scan, tray/window, or backend queue behavior requires a dedicated behavior sub-checkpoint first.

Planned sequence:
- Completed Step 629: scanned `App.vue` runtime boundaries, selected `AppMainContent` props/listeners binding construction as the first low-risk extraction target because it does not move root-owned playback/lyrics/download/navigation behavior, established a passing `npx vue-tsc --noEmit` baseline, and preserved state-driven navigation/no-router semantics.
- Completed Step 630: extracted `AppMainContent` props/listeners binding construction into `src/composables/useAppMainContentBindings.ts`, updated `App.vue` to pass root-owned getters and handlers into the composable, kept all playback/lyrics/download/navigation state and handlers owned by `App.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 631: rescanned remaining child binding construction in `App.vue`, selected `PlayerDock` props/listeners binding as the next safe extraction target because it only adapts root playback/lyrics/download state and handlers to the dock component, and left playback runtime ownership unchanged.
- Completed Step 632: extracted `PlayerDock` props/listeners binding construction into `src/composables/usePlayerDockBindings.ts`, updated `App.vue` to pass root-owned playback/lyrics/download getters and handlers into the composable, kept playback runtime state, Rust queue handling, lyrics dock behavior, and player commands owned by `App.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 633: rescanned `LyricsView` binding construction in `App.vue`, confirmed it only adapts root playback/lyrics state and root lyrics handlers into the view contract, and selected it as the next safe binding extraction without moving lyrics loading/search/update behavior.
- Completed Step 634: extracted `LyricsView` props/listeners binding construction into `src/composables/useLyricsViewBindings.ts`, updated `App.vue` to pass root-owned playback/lyrics getters and handlers into the composable, kept lyrics runtime behavior, cover refresh handling, lyrics mutation handlers, dock visibility handlers, and seek handling owned by `App.vue`, and passed `npx vue-tsc --noEmit`.
- Completed Step 635: rescanned dialog/context-menu binding construction in `App.vue`, selected `AppDialogs` props/listeners binding as the next safe extraction target because it only adapts root dialog/scan/metadata state and handlers into the dialog shell, and kept dialog behavior root-owned.
- Completed Step 636: extracted `AppDialogs` props/listeners binding construction into `src/composables/useAppDialogsBindings.ts`, updated `App.vue` to pass root-owned dialog/scan/playlist/metadata getters and handlers into the composable, kept dialog open/close, scan, playlist creation, add-to-playlist, and metadata save behavior in existing owners, and passed `npx vue-tsc --noEmit`.
- Completed Step 637: extracted playlist/track context-menu props/listeners binding construction into `src/composables/useAppContextMenuBindings.ts`, updated `App.vue` to pass root-owned menu getters and action handlers into the composable, preserved null-based menu visibility, playlist menu actions, track menu capability flags, favorite/download checks, and all context-menu actions, and passed `npx vue-tsc --noEmit`.
- Completed Step 638: rescanned `App.vue` after child binding extractions, confirmed child binding construction now lives in focused composables for main content, player dock, lyrics view, dialogs, and context menus, and identified the remaining root complexity as runtime ownership/handler wiring rather than more safe binding cleanup.
- Completed Step 639: ran final verification for the `App.vue` binding-extraction pass, confirmed `npx vue-tsc --noEmit` passes, and documented that the next meaningful checkpoints are behavior-level splits for playback runtime, lyrics runtime, downloads/scan runtime, tray/window runtime, or backend queue synchronization rather than more child-binding extraction.
- Completed Step 640: fixed the Vite startup failure caused by duplicate bare `v-bind` usage in `AppMainContent.vue`, changed listener maps on `AppSidebarOutlet` and `AppPageOutlet` from `v-bind` to `v-on`, confirmed no remaining `v-bind="*Listeners"` pattern, and passed `npx vue-tsc --noEmit`.
- Completed Step 641: extracted small root shell derived state (`startupLoadingText`, `shouldShowLibraryResizeHandle`, `hasThemeBackground`) into `src/composables/useAppShellState.ts`, updated `App.vue` to consume the composable after navigation state setup, preserved loading text, resize-handle visibility, theme-background class behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 642: ran final verification for this continuation, confirmed `npx vue-tsc --noEmit` passes, noted that `App.vue` line count remains high because root handler wiring still lives there, and identified the next useful work as a behavior-level checkpoint for playback runtime or lyrics runtime rather than further shell/binding cleanup.

## Playback Runtime Split Checkpoint

Assumptions:
- Playback runtime spans root playback UI state, local/online playback actions, Rust queue commands, backend queue snapshots, player dock callbacks, system media sync, sleep timer, and lyrics playback timing.
- The first safe boundary is extracting root playback UI runtime state (`isAudioPlaying`, playback time, spectrum, seek/toggle request counters) and its simple update handlers because it does not move playback commands or backend lifecycle.
- Deeper changes to Rust playback commands, online/local playback actions, queue snapshot sync, or sleep timer behavior need their own sub-checkpoints.

Success criteria:
- Playback runtime cleanup preserves player dock playback state callbacks, spectrum updates, time updates, seek request values, toggle request values, lyrics timing inputs, system media sync inputs, and all playback commands.
- Each playback runtime step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving Rust backend command ownership or queue synchronization requires a dedicated behavior checkpoint first.

Planned sequence:
- Completed Step 643: extracted root playback UI runtime refs and simple update handlers into `src/composables/usePlaybackRuntimeState.ts`, updated `App.vue` to consume `isAudioPlaying`, playback time, spectrum levels, seek/toggle request refs, and dock callback update handlers from the composable, kept playback command ownership, Rust backend calls, queue sync, lyrics timing consumers, and system media sync inputs unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 644: rescanned playback runtime wiring after UI state extraction, kept local/online playback actions and Rust backend lifecycle ownership unchanged, selected root Rust playback queue wrapper extraction as the next safe boundary because it only forwards queue start/restore/snapshot calls.
- Completed Step 645: extracted root Rust playback queue start/restore wrapper forwarding into `src/composables/useRustPlaybackQueueBridge.ts`, updated `App.vue` to route start and restore calls through the bridge while preserving the hoisted `handleRustQueueSnapshot` entrypoint as a direct snapshot-controller delegate for earlier callers, kept Rust lifecycle command behavior and queue snapshot semantics unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 646: rescanned playback runtime after the queue bridge extraction, confirmed existing playback action composables already own most command behavior, selected external playback event wiring as the next low-risk split because it only groups desktop lyrics, system media, tray menu, and app event listener assembly, and passed `npx vue-tsc --noEmit`.
- Completed Step 647: extracted external playback event wiring into `src/composables/useExternalPlaybackEventBridge.ts`, updated `App.vue` to consume the bridge for desktop lyrics, system media, tray menu, download, MCP sleep timer, and Rust queue listener assembly, preserved event names, listener lifecycle, tray action behavior, desktop lyrics ready broadcast, restoring-queue snapshot gating, and passed `npx vue-tsc --noEmit`.
- Completed Step 648: rescanned the remaining playback-runtime assembly in `App.vue`, deferred local/online playback command ownership because those paths coordinate Rust backend commands, plugin fallback, queue switching, and error recovery, and selected playback session plus sleep-timer exit wiring as the next safe split because it only composes existing session persistence and exit behavior.
- Completed Step 649: extracted playback session persistence and sleep-timer exit wiring into `src/composables/usePlaybackSessionRuntime.ts`, updated `App.vue` to consume restore request ids, restore time, restore/save session handlers, and sleep-timer exit handler from the runtime composable, preserved unload persistence, scheduled save behavior, playback queue session input, and exit behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 650: ran a final playback-runtime rescan, confirmed local/online playback commands, Rust playback transport, queue snapshot controller, and active seek actions are now behavior-heavy ownership boundaries, selected system media sync wiring as one remaining low-risk external playback integration cleanup, and passed `npx vue-tsc --noEmit`.
- Completed Step 651: moved system media sync wiring under `src/composables/useExternalPlaybackEventBridge.ts`, updated `App.vue` to pass `activeTrack` into the bridge instead of mounting `useSystemMediaSync` directly, preserved active track, playback time, playing state inputs, throttling, clear behavior, and Tauri runtime guard, and passed `npx vue-tsc --noEmit`.
- Completed Step 652: performed final playback-runtime checkpoint verification, confirmed `npx vue-tsc --noEmit` passes, confirmed `App.vue` no longer directly mounts external playback event listeners, system media sync, playback session persistence, or sleep-timer exit wiring, and documented that the remaining playback boundaries should be handled only as dedicated behavior migrations: local playback commands, online playback commands, Rust transport failure recovery, and queue snapshot synchronization.

## Lyrics Runtime Split Checkpoint

Assumptions:
- Lyrics runtime spans lyrics view state, local lyrics loading, online lyrics loading, mutation of active/current track lyrics, lyric format selection, desktop lyrics sync, and lyrics-view bindings.
- Existing lyrics composables already own most behavior; the safe next boundary is reducing root-level assembly where it only composes existing lyrics modules.
- Lyrics data mutation, provider lookup, local/online loading semantics, and desktop lyrics broadcast behavior should not change in this checkpoint.

Success criteria:
- Lyrics runtime cleanup preserves active lyrics status, track-key selection, local/online lyrics loading, source lyrics updates, lyric format selection, desktop lyrics state sync, cover refresh, dock visibility, and seek callbacks.
- Each lyrics runtime step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving lyrics loading algorithms or track mutation behavior requires a dedicated behavior checkpoint first.

Planned sequence:
- Completed Step 653: scanned lyrics runtime wiring in `App.vue`, confirmed existing composables already own lyrics state, mutation, local loader, online loader, format selection, and desktop sync behavior, selected root lyrics-runtime assembly extraction as the smallest low-risk boundary, and deferred loader algorithm or mutation semantics changes to a dedicated behavior checkpoint.
- Completed Step 654: extracted lyrics-runtime assembly into `src/composables/usePlaybackLyricsRuntime.ts`, updated `App.vue` to consume lyrics state outputs, local/online loader callbacks, lyric format state, desktop lyrics sync handlers, and mutation handlers from the runtime composable, preserved local known-track lookup inputs, online lyrics request inputs, format registration, desktop lyrics broadcast behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 655: rescanned lyrics runtime after assembly extraction, confirmed `npx vue-tsc --noEmit` passes, confirmed `App.vue` no longer manually assembles lyrics state, mutation, loaders, format registration, or desktop lyrics sync, and stopped before deeper lyrics-view visibility/dock behavior changes because those already live in focused composables and further work would require behavior-specific checkpoints.

## Page State Ownership Checkpoint

Assumptions:
- Navigation stays state-driven in this pass; do not introduce Vue Router.
- Page-specific loading, query, selection, pagination, and panel-only state should live in page/outlet components or page composables, not in `App.vue`.
- Cross-page state that truly drives shell layout, playback, queue, library navigation, or backend lifecycle can remain above pages.

Success criteria:
- Page-state cleanup preserves current menu navigation, active page rendering, page props/listeners contracts, local library panels, online search, downloads, plugins, settings, and playback controls.
- Each page-state step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving navigation semantics or route ownership is out of scope.

Planned sequence:
- Completed Step 656: scanned page/outlet components and `App.vue` page-facing props, confirmed `DiscoverMusicPage.vue` owns online search query/loading/provider/history state, settings/plugins/theme pages own their local UI state, and `App.vue` mostly retains cross-page playback, library navigation, queue, and online-search snapshot data needed by playback; selected `AppPageOutlet` page binding construction as the next safe structural cleanup because it only adapts shell state into page-specific contracts, and passed `npx vue-tsc --noEmit`.
- Completed Step 657: extracted `AppPageOutlet` page props/listeners binding construction into `src/composables/useAppPageOutletBindings.ts`, updated `AppPageOutlet.vue` to focus on active-view outlet selection, preserved page state ownership, active-view branching, all page props/listeners contracts, online-search snapshot emits, download/list/library/workspace/artists/utility actions, and passed `npx vue-tsc --noEmit`.
- Completed Step 658: rescanned the page/outlet layer after `AppPageOutlet` binding extraction, confirmed page-owned state remains inside page components, identified `AppMainContent.vue` sidebar/page outlet props/listeners adaptation as another pure structural cleanup, and left `AppLayout` layout variant behavior unchanged.
- Completed Step 659: extracted `AppMainContent` sidebar/page outlet binding construction into `src/composables/useAppMainContentOutletBindings.ts`, updated `AppMainContent.vue` to focus on `AppLayout`, sidebar outlet, page outlet, and layout variant calculation, preserved sidebar menu semantics, page props/listeners contracts, resize handling, and emitted actions, and passed `npx vue-tsc --noEmit`.
- Completed Step 660: ran final page-state ownership verification, confirmed `npx vue-tsc --noEmit` passes, confirmed online search query/loading/provider/history state remains inside `DiscoverMusicPage.vue`, confirmed `App.vue` only retains cross-page playback/library/search snapshot data, and documented that navigation remains state-driven without Vue Router in this pass.

## Dialog And Scan Runtime Checkpoint

Assumptions:
- Dialog visibility, scan folder selection, playlist creation, add-to-playlist, and track metadata editing are app-level workflows rather than page-local state.
- Existing dialog components should remain presentational shells; business behavior should stay in composables such as scan, playlist, and metadata controllers.
- The safe boundary is scanning for root-level dialog/scan assembly that can be reduced without changing modal behavior, scan backend calls, playlist mutations, or metadata writes.

Success criteria:
- Dialog/scan cleanup preserves scan folder add/remove/check/cancel/confirm behavior, playlist dialog behavior, add-to-playlist behavior, metadata edit/save behavior, dialog close behavior, and all `AppDialogs` props/listeners contracts.
- Each dialog/scan step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving scan backend behavior, playlist mutation semantics, or metadata save semantics requires a dedicated behavior checkpoint first.

Planned sequence:
- Completed Step 661: scanned dialog and scan runtime wiring in `App.vue`, `AppDialogs.vue`, `useAppDialogsBindings.ts`, `useScanFolders.ts`, and `useTrackMetadataDialog.ts`, confirmed scan state and progress listeners already live in `useScanFolders`, metadata editing behavior lives in `useTrackMetadataDialog`, playlist/add-to-playlist dialog state lives in playlist composables, `AppDialogs.vue` is a presentational shell, and stopped before moving scan backend behavior, playlist mutation semantics, or metadata save/patch semantics; verified `npx vue-tsc --noEmit` passes.

## Remaining Architecture Scan Checkpoint

Assumptions:
- The largest remaining risks should be identified by actual file size, dependency concentration, and behavior ownership rather than by extracting thin wrappers.
- Continue only with changes that have a clear ownership improvement and can be verified by `npx vue-tsc --noEmit`.
- Behavior-heavy areas should be documented as future checkpoints instead of casually refactored.

Success criteria:
- Remaining architecture scan lists the next concrete candidates and chooses one safe continuation target.
- Each change passes `npx vue-tsc --noEmit` before the document is marked complete.

Planned sequence:
- Completed Step 662: scanned current large frontend files and composables, identified `App.vue`, `LyricsView.vue`, `PlayerDock.vue`, `usePlayerDockRuntime.ts`, `PluginManagerView.vue`, and `TrackTable.vue` as the largest remaining frontend surfaces, skipped playback dock/runtime and track table because their remaining complexity is behavior-heavy or already checkpointed, selected `PluginManagerView.vue` panel binding construction as the next highest-value low-risk cleanup target because plugin page state is already page-owned and panel props/listeners adaptation is structural.
- Completed Step 663: extracted `PluginManagerView` market-panel props/listeners binding construction into `src/composables/usePluginMarketPanelBindings.ts`, updated `PluginManagerView.vue` to consume the composable, preserved plugin market filtering, action handling, screenshot navigation, category/status selection, search state updates, and passed `npx vue-tsc --noEmit`.
- Completed Step 664: extracted installed-plugins panel props/listeners binding construction into `src/composables/usePluginInstalledPanelBindings.ts`, updated `PluginManagerView.vue` to consume the composable, preserved selection state, batch disable/install/uninstall actions, install/update/remove/toggle behavior, drag sorting callbacks, selected counts, visible plugin rows, and passed `npx vue-tsc --noEmit`.
- Completed Step 665: extracted plugin subscriptions panel props/listeners binding construction into `src/composables/usePluginSubscriptionsPanelBindings.ts`, updated `PluginManagerView.vue` to consume the composable, preserved subscription URL state updates, add/import/remove/sync behavior, syncing state callback, loading overlay condition, and passed `npx vue-tsc --noEmit`.
- Completed Step 666: performed final plugin manager verification, confirmed `npx vue-tsc --noEmit` passes, confirmed `PluginManagerView.vue` now keeps plugin page state and runtime composition while delegating market/installed/subscriptions panel binding construction to focused composables, and documented remaining plugin behavior-heavy boundaries as catalog loading, install/update/remove workflows, drag sorting persistence, market filtering/action handling, and subscription sync semantics.
- Completed Step 667: ran another architecture scan after plugin manager cleanup, confirmed `npx vue-tsc --noEmit` passes, identified `LyricsView.vue`, `PlayerDock.vue`, `usePlayerDockRuntime.ts`, `TrackTable.vue`, and store/service modules as remaining large surfaces, skipped player dock/runtime and track table because they are behavior-heavy or already checkpointed, and selected `LyricsView.vue` panel/overlay props binding construction as the next safe target.
- Completed Step 668: extracted `LyricsView.vue` stage/action-menu/search-dialog props binding construction into `src/composables/useLyricsViewPanelBindings.ts`, updated `LyricsView.vue` to consume the composable, preserved lyrics loading, search, download, cover, scroll, sync, fullscreen, emitted actions, and passed `npx vue-tsc --noEmit`.
- Completed Step 669: performed final verification for this continuation, confirmed `npx vue-tsc --noEmit` passes, rescanned largest remaining files, and documented that store/service modules, player dock runtime, Rust player backend, track metadata mutation, scan behavior, and plugin install/catalog behavior should only be handled as dedicated behavior checkpoints.

## Player Dock Presentation Checkpoint

Assumptions:
- `PlayerDock.vue` is a user-facing playback surface that composes transport controls, queue popover, progress, cover, sleep timer, volume, quality, and lyrics controls.
- Playback runtime behavior, Rust backend listener behavior, queue operations, and sleep-timer semantics should not move in this presentation checkpoint.
- The safe boundary is reducing child props/listeners binding construction if it exists, while keeping dock runtime composables and emitted commands unchanged.

Success criteria:
- Player dock cleanup preserves playback transport commands, progress/seek behavior, queue popover behavior, sleep timer behavior, volume/speed/quality controls, cover behavior, and all root emits.
- Each player dock presentation step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving `usePlayerDockRuntime.ts` internals requires a dedicated playback behavior checkpoint first.

Planned sequence:
- Completed Step 670: scanned `PlayerDock.vue`, confirmed playback runtime, progress, queue, sleep timer, cover, labels, and lifecycle behavior already live in focused composables, selected child control props binding construction (`PlaybackMetaControls`, `NowPlayingInfo`, `TransportControls`) as the smallest safe presentation-only target, and left `usePlayerDockRuntime.ts` behavior unchanged.
- Completed Step 671: extracted `PlayerDock.vue` child control props binding construction into `src/composables/usePlayerDockControlBindings.ts`, updated `PlayerDock.vue` to consume the composable for `PlaybackMetaControls`, `NowPlayingInfo`, and `TransportControls`, preserved dock runtime behavior, lifecycle watchers, queue popover, progress/seek, sleep timer, emitted commands, and passed `npx vue-tsc --noEmit`.
- Completed Step 672: performed final scan after player dock presentation cleanup, confirmed `npx vue-tsc --noEmit` passes, identified remaining large surfaces as `App.vue`, `stores/player.ts`, `LyricsView.vue`, `usePlayerDockRuntime.ts`, `stores/player/theme.ts`, `PlayerDock.vue`, `TrackTable.vue`, `usePluginMarket.ts`, and service modules, and documented that playback runtime, Rust backend, track table behavior, store mutation semantics, and service calls require dedicated behavior checkpoints rather than incidental extraction.

## Player Store Checkpoint

Assumptions:
- The player store owns persisted library/settings/playback state and must not change mutation semantics casually.
- Any store cleanup must preserve persistence keys, scan/import behavior, settings defaults, queue/current-track behavior, favorites/playlists, and playback session restore/save behavior.
- The safe first step is scanning the store shape and existing store submodules before moving code.

Success criteria:
- Store cleanup preserves all public store fields/actions consumed by components and composables.
- Each store step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving persistence format or state semantics requires a dedicated migration checkpoint first.

Planned sequence:
- Completed Step 673: scanned `src/stores/player.ts` and existing store submodules (`constants`, `favorites`, `normalizers`, `playlists`, `playbackSession`, `theme`), confirmed scan/import, playback session, favorites, playlists, and theme behavior already have submodule boundaries, selected pure settings setter extraction as the safest store split because those setters only update `settings` and call `persistSettings`, and deferred `loadLibrary`, `scanLibrary`, `setMusicDirs`, playback session restore/save, favorites, playlists, and theme side effects to dedicated behavior checkpoints.
- Completed Step 674: extracted pure player settings setters into `src/stores/player/settingsActions.ts`, updated `src/stores/player.ts` to compose those actions while preserving all public store action names, validation/clamping, quality fallback and failure-action guards, and `persistSettings` behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 675: rescanned the remaining player store surface after settings extraction, confirmed scan/import, `setMusicDirs`, playback session restore/save, and theme listeners remain behavior-heavy store boundaries, selected playlist action wrappers as the next safe split because they only adapt existing pure playlist helpers into `settings.playlists` writes plus `persistSettings`, and passed `npx vue-tsc --noEmit`.
- Completed Step 676: extracted playlist store actions into `src/stores/player/playlistActions.ts`, updated `src/stores/player.ts` to compose `createPlaylist`, `renamePlaylist`, `deletePlaylist`, `addTrackToPlaylist`, and `removeTrackFromPlaylist` from the focused module, preserved existing pure playlist helper usage, `settings.playlists` writeback, boolean return behavior, and `persistSettings` calls, and passed `npx vue-tsc --noEmit`.
- Completed Step 677: rescanned the player store after playlist action extraction, confirmed favorite pure helpers already live in `src/stores/player/favorites.ts`, selected favorite store action wrappers as the next safe split because they only compute the favorite id set, resolve favorite tracks, toggle favorite snapshots, and call the existing favorites persistence adapter, and passed `npx vue-tsc --noEmit`.
- Completed Step 678: extracted favorite store computed/action wiring into `src/stores/player/favoriteActions.ts`, updated `src/stores/player.ts` to compose `favoriteTracks`, `isFavorite`, and `toggleFavorite` from that module while keeping favorite id/snapshot state in the store, preserved favorite snapshot writes, null-track behavior, boolean return behavior, and `persistFavorites` calls, and passed `npx vue-tsc --noEmit`.
- Completed Step 679: rescanned the remaining player store after settings, playlist, and favorite extraction, confirmed library loading/scanning, directory removal, persisted hydration, playback session persistence/restore, and theme event listeners remain behavior-heavy boundaries, selected basic playback state derivations/actions as the final low-risk store split because they only cover filtered tracks, current source, playback mode label/toggle, current-track assignment, and recently-played id persistence, and passed `npx vue-tsc --noEmit`.
- Completed Step 680: extracted basic playback state derivations/actions into `src/stores/player/playbackStateActions.ts`, updated `src/stores/player.ts` to compose `filteredTracks`, `currentSource`, `playbackModeLabel`, `setCurrentTrack`, `togglePlaybackMode`, and `recordRecentlyPlayed` from that module, preserved search matching, audio source conversion, playback-mode label wording, shuffle/repeat/fixed cycle order, current-track assignment, recently-played id capping, and `persistSettings` behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 681: performed a final player store architecture scan after the low-risk extractions, confirmed `npx vue-tsc --noEmit` passes, confirmed `src/stores/player.ts` now composes settings, playlists, favorites, basic playback state, playback session helpers, and theme controller from focused submodules, and documented the remaining store responsibilities as dedicated future checkpoints rather than incidental splits: persisted hydration, library loading/scanning, music directory removal reconciliation, playback session persistence/restore, and theme event-listener lifecycle.

## Player Store Normalizer Checkpoint

Assumptions:
- Store normalizers are pure data-shaping utilities and can be reorganized by domain without changing runtime behavior.
- Persistence formats, default values, fallback rules, playlist/favorite/theme/session normalization semantics, and public imports must remain stable.
- This checkpoint should only split pure normalizer ownership; it must not change the store hydration flow or persisted keys.

Success criteria:
- Normalizer cleanup preserves settings, track path, local path, favorite store, custom theme, playback session, built-in/custom theme, and cached system theme normalization behavior.
- Each normalizer step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Changing persistence migration semantics or fallback values requires a dedicated migration checkpoint first.

Planned sequence:
- Completed Step 682: scanned `src/stores/player/normalizers.ts` and its consumers, confirmed settings normalization, track/path normalization, favorite snapshot normalization, custom theme normalization, playback session normalization, and cached system theme normalization are all pure data-shaping utilities, selected path normalization and track de-duplication as the first safe split because those functions have no persisted-format decisions, and passed `npx vue-tsc --noEmit`.
- Completed Step 683: extracted path normalization utilities into `src/stores/player/pathNormalizers.ts`, updated `src/stores/player/normalizers.ts` to import and re-export `normalizeTrackPath`, `normalizeLocalPathInput`, and `dedupeTracksByPath` so existing import paths remain stable, preserved path normalization, file URL decoding, and de-duplication behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 684: extracted favorite and track snapshot normalization into `src/stores/player/favoriteNormalizers.ts`, updated `src/stores/player/normalizers.ts` to import and re-export `normalizeFavoriteTrackIds`, `normalizeTrackSnapshot`, `normalizeFavoriteTracks`, and `normalizeFavoriteStore`, preserved track snapshot field defaults, lyrics normalization, favorite id de-duplication, favorite store backward compatibility, and existing public import paths, and passed `npx vue-tsc --noEmit`.
- Completed Step 685: rescanned the remaining normalizer surface, confirmed custom theme normalization, built-in/custom theme guards, cached system theme normalization, and playback session normalization can be split as pure domain helpers while settings normalization remains the persistence-migration-heavy center, selected theme normalizers as the next safe split because they align with `theme.ts` and do not alter hydration flow, and passed `npx vue-tsc --noEmit`.
- Completed Step 686: extracted theme-related normalizers into `src/stores/player/themeNormalizers.ts`, updated `src/stores/player/normalizers.ts` to import and re-export `normalizeCustomThemes`, `isBuiltInTheme`, `isCustomTheme`, `normalizeCachedSystemThemeState`, and `CachedSystemThemeState`, preserved custom theme filtering, built-in/custom theme guards, cached system theme validation, existing public import paths, and theme controller imports, and passed `npx vue-tsc --noEmit`.
- Completed Step 687: extracted playback session normalization into `src/stores/player/playbackSessionNormalizers.ts`, updated `src/stores/player/normalizers.ts` to re-export `normalizePlaybackSession`, preserved playback mode fallback, current time clamping, current track snapshot normalization, queue de-duplication, current-track queue insertion, null-session handling, existing public import paths, and passed `npx vue-tsc --noEmit`.
- Completed Step 688: performed a final normalizer architecture scan, confirmed `normalizers.ts` now only contains settings normalization plus domain re-exports, selected a dedicated settings normalizer module as the final normalizer split so `normalizers.ts` can become a stable barrel, and passed `npx vue-tsc --noEmit`.
- Completed Step 689: moved `normalizeSettings` into `src/stores/player/settingsNormalizers.ts`, updated `src/stores/player/normalizers.ts` into a stable barrel that re-exports settings, favorites, paths, playback session, and theme normalizers, preserved settings fallback, numeric clamping, theme migration, playlist normalization, Chinese playlist fallback value, existing public import paths, and passed `npx vue-tsc --noEmit`.
- Completed Step 690: scanned the remaining largest frontend/store/service files after the store and normalizer cleanup, confirmed `App.vue`, player theme controller, player dock runtime, backend service wrappers, and track table remain behavior-heavy or previously checkpointed, selected `src/composables/usePluginMarket.ts` as the next safe architecture target because it still combines market item derivation, filters, selected-detail state, screenshot navigation, labels, and install/update action state, and passed `npx vue-tsc --noEmit`.

## Plugin Market Composable Checkpoint

Assumptions:
- Plugin catalog loading, install/update workflows, and plugin persistence semantics must remain unchanged.
- The safe cleanup is to split local UI state and pure derived bindings out of `usePluginMarket.ts` without changing public return names used by `PluginManagerView.vue` and plugin market components.
- Existing label strings and market item mapping should be preserved unless a dedicated i18n cleanup checkpoint is started.

Success criteria:
- Plugin market cleanup preserves category/status/search filtering, selected plugin behavior, screenshot navigation, action labels, install/update guards, installing state, notifications, and all existing return keys.
- Each plugin market step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving catalog fetch/install/update behavior requires a dedicated plugin workflow checkpoint first.

Planned sequence:
- Completed Step 691: extracted selected market plugin and screenshot navigation state into `src/composables/usePluginMarketSelection.ts`, updated `src/composables/usePluginMarket.ts` to compose selected plugin, selected id, screenshot list, active screenshot, category selection, plugin selection, and previous/next/specific screenshot actions from that composable, preserved all public return keys, selection fallback behavior, screenshot index reset behavior, category-change default selection behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 692: scanned the remaining `usePluginMarket.ts` responsibilities, confirmed install/update workflow and notification behavior should stay in place for now, selected market filter state/results as the next safe split because it only owns search text, active category/status filters, localized-capability keyword matching, and filtered plugin derivation, and passed `npx vue-tsc --noEmit`.
- Completed Step 693: extracted plugin market filter state and filtered result derivation into `src/composables/usePluginMarketFilters.ts`, updated `src/composables/usePluginMarket.ts` to compose `activeMarketCategory`, `activeMarketStatus`, `marketSearch`, and `filteredMarketPlugins` from that composable, preserved category/status/search matching, localized capability keyword matching, all public return keys, and passed `npx vue-tsc --noEmit`.
- Completed Step 694: rescanned `usePluginMarket.ts` after filter extraction, confirmed install/update action state and notifications remain behavior-sensitive, selected pure market item mapping helpers as the next safe split because they only map catalog/manifest data into `PluginMarketItem` records and source/status/tag metadata, and passed `npx vue-tsc --noEmit`.
- Completed Step 695: extracted plugin market item mapping helpers into `src/composables/pluginMarketItems.ts`, updated `src/composables/usePluginMarket.ts` to consume `toRealMarketPlugin` and `isMarketPluginKind`, preserved market item fields, source labels, status calculation, tag fallback behavior, public return keys, and install/update workflow ownership; also repaired previously corrupted plugin market Chinese display strings uncovered by type checking, and passed `npx vue-tsc --noEmit`.
- Completed Step 696: rescanned `usePluginMarket.ts` after item mapping extraction, confirmed the remaining safe split is display label derivation while install/update action state remains behavior-sensitive, selected capability/permission/category/status/action label helpers as the next safe split, and passed `npx vue-tsc --noEmit`.
- Completed Step 697: extracted plugin market display label helpers into `src/composables/usePluginMarketLabels.ts`, updated `src/composables/usePluginMarket.ts` to compose `localizedCapability`, `localizedPermission`, `pluginKindLabel`, `pluginStatusLabel`, and `pluginActionLabel` from that composable, preserved locale behavior, category/status/action labels, installing-state action labels, all public return keys, and passed `npx vue-tsc --noEmit`.
- Completed Step 698: performed a final plugin market composable scan, confirmed `src/composables/usePluginMarket.ts` now composes market item mapping, filter state, display labels, selected plugin/screenshot state, and panel bindings from focused modules, confirmed `npx vue-tsc --noEmit` passes, and documented the remaining plugin market action state as a future dedicated workflow checkpoint because it owns install/update guards, installing id state, notifications, and error handling.
- Completed Step 699: rescanned the remaining largest frontend/store/service files after the plugin market cleanup, confirmed `App.vue`, `LyricsView.vue`, player dock runtime, backend service wrappers, and track table remain behavior-heavy or previously checkpointed, selected `src/stores/player/theme.ts` pure system-theme variable generation as the next safe architecture target because it is a large self-contained calculation that does not touch DOM mutation, persistence, refresh scheduling, or store state, and passed `npx vue-tsc --noEmit`.

## Player Theme Controller Checkpoint

Assumptions:
- Theme controller owns DOM CSS variable application, theme persistence, custom theme management, cached system theme state, and refresh scheduling.
- Behavior that writes DOM variables, persistent values, or schedules system theme refreshes should remain in the controller unless handled by a dedicated behavior checkpoint.
- Pure theme variable generation can be split safely if returned CSS variable names and values remain unchanged.

Success criteria:
- Theme cleanup preserves theme switching, custom theme variables, wallpaper/system theme variables, cached theme fallback, startup background persistence, system theme refresh throttling, and public controller return keys.
- Each theme step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving DOM mutation, persistence, or refresh scheduling requires a dedicated theme behavior checkpoint first.

Planned sequence:
- Completed Step 700: extracted pure system-theme CSS variable generation into `src/stores/player/systemThemeVariables.ts`, updated `src/stores/player/theme.ts` to import `systemThemeVariables` while keeping DOM application, cached fallback, persistence, and refresh scheduling in the theme controller, preserved all dark/light CSS variable names and values, wallpaper accent fallback behavior, and passed `npx vue-tsc --noEmit`.
- Completed Step 701: rescanned the remaining theme controller after system-theme variable extraction, confirmed DOM variable application, theme persistence, startup background persistence, cached system theme application, refresh throttling, and system theme event handling remain behavior-heavy, selected custom theme asset source conversion as one final low-risk split because it only maps local paths through Tauri `convertFileSrc` while leaving DOM writes unchanged, and passed `npx vue-tsc --noEmit`.
- Completed Step 702: extracted custom theme asset source conversion into `src/stores/player/themeAssets.ts`, updated `src/stores/player/theme.ts` to import `themeAssetSrc` and no longer import Tauri `convertFileSrc` directly, preserved URL/data/blob/root-path passthrough, local file conversion behavior, custom theme background CSS writing, and passed `npx vue-tsc --noEmit`.
- Completed Step 703: performed a final theme controller scan, confirmed `src/stores/player/theme.ts` now delegates pure system-theme variable generation and theme asset source conversion to focused helpers, confirmed `npx vue-tsc --noEmit` passes, and documented the remaining theme responsibilities as dedicated future behavior checkpoints rather than incidental splits: DOM variable application/cleanup, theme persistence side effects, startup background persistence, cached system theme application, refresh throttling, and system theme event handling.
- Completed Step 704: performed a global architecture scan after the store, normalizer, plugin market, and theme controller cleanup, confirmed `npx vue-tsc --noEmit` passes, confirmed the largest remaining behavior-heavy areas are `App.vue`, player dock runtime, lyrics cover loading, backend service wrappers, plugin install workflows, and track metadata mutation, selected `TrackTable.vue` row props/listeners binding construction as the next safe presentation checkpoint because it only adapts existing table state and emits into `TrackTableRow` props/listeners.

## Track Table Presentation Checkpoint

Assumptions:
- Track table owns display composition for headers, visible rows, row props, row listeners, and scoped slots.
- Paging, active-row detection, row state computation, labels, style computation, and interaction callbacks already live in focused composables and should not change in this checkpoint.
- The safe cleanup is to move row/header binding construction out of `TrackTable.vue` while preserving the component's props, emits, expose API, slots, and CSS.

Success criteria:
- Track table cleanup preserves visible row rendering, header props, row props, row listeners, download/favorite/context/artist/play/select events, row refs, labels, player settings, and scoped slots.
- Each track table step passes `npx vue-tsc --noEmit` before the document is marked complete.
- Moving paging, row-state algorithms, interaction behavior, or CSS layout requires a dedicated table behavior checkpoint first.

Planned sequence:
- Completed Step 705: extracted `TrackTable.vue` header props, row props, and row listeners construction into `src/composables/useTrackTableRowBindings.ts`, updated `TrackTable.vue` to consume that composable while preserving visible row rendering, header props, row props, row listeners, row refs, download/favorite/context/artist/play/select events, player settings, scoped slots, expose API, CSS layout, and passed `npx vue-tsc --noEmit`.
- Completed Step 706: performed a final track table presentation scan, confirmed `TrackTable.vue` now composes active-row, style, labels, paging, row state, interactions, and row/header bindings from focused composables, confirmed `npx vue-tsc --noEmit` passes, and documented remaining table responsibilities as future dedicated checkpoints rather than incidental splits: CSS grid/responsive layout, paging behavior, row-state algorithms, active-row matching, and interaction semantics.
- Completed Step 707: ran final verification, confirmed `npx vue-tsc --noEmit` passes, reviewed the current git status without reverting unrelated dirty worktree changes, and summarized the completed cleanup scope plus remaining behavior-heavy future boundaries: root app orchestration/playback command ownership, player dock runtime behavior, lyrics cover loading/cache behavior, backend service wrappers, plugin install workflows, track metadata mutation workflows, and table CSS/interaction behavior.

## Interaction Regression Hotfix

Assumptions:
- Listener binding objects named `*Listeners` use Vue `onXxx` prop keys and must be passed as component props, not as `v-on` object event maps.
- The reported symptom that menus and buttons could not be clicked is consistent with child component events no longer reaching parent handlers after the binding extraction.
- Fixing broken Chinese string literals uncovered by type checking is required to restore a valid frontend build.

Success criteria:
- Menu/sidebar/page/player/plugin/table listener objects are bound correctly so child events reach parent handlers.
- Previously corrupted download/plugin market Chinese string literals compile again.
- `npx vue-tsc --noEmit` passes after the fix.

Planned sequence:
- Completed Hotfix Step 708: replaced template usages of `v-on="*Listeners"` with `v-bind="*Listeners"` so `onXxx` listener objects are passed as Vue listener props, repaired corrupted Chinese string literals in plugin market and download manager views, verified no `v-on=` listener-object bindings remain, and passed `npx vue-tsc --noEmit`.
- Completed Hotfix Step 709: merged duplicated component `v-bind` props/listener bindings after the listener hotfix, repaired corrupted Chinese strings in `DiscoverMusicPage.vue` and `ThemeView.vue` that blocked Vite startup/type checking, verified no `v-on=` usages or known mojibake Chinese markers remain, and passed `npx vue-tsc --noEmit`.
- Completed Hotfix Step 710: started the local Vite dev server on `http://127.0.0.1:5173`, confirmed the page renders instead of showing a Vite compile overlay, verified sidebar/menu clicks for Artists, Settings, Themes, and the bottom Queue button all trigger UI changes, and documented that plain-browser Tauri `invoke/listen` console errors are expected outside the Tauri shell rather than listener-binding regressions.
- Completed Hotfix Step 711: restored the track list visual contract after splitting `TrackTable` into row/header/cell components by adding parent table `:deep(...)` scoped rules for row cell overflow, artist-link style, actions alignment, title gap/text truncation, cover-column spacing, and mobile column hiding; this preserves the extracted components while matching the pre-split table CSS behavior, and passed `npx vue-tsc --noEmit`.
- Completed Hotfix Step 712: restored the playback meta controls icon sizing contract after splitting the dock controls into child components by adding parent `:deep(...)` rules in `PlaybackMetaControls.vue` so right-side dock icon buttons keep a stable 28px box and 18px icons on hover/focus, preventing the speed, volume, and queue icons from shifting, and passed `npx vue-tsc --noEmit`.
