# App Layout Refactor Plan

## Goal

Reduce `App.vue` template size by extracting layout/page-dispatch components first, without changing the current state model or introducing router.

## Principle

First move template structure only. Existing state, computed values, and business methods still come from `App.vue` and are passed down as props/events. After the template split is stable, state can be moved in smaller follow-up steps.

## Steps

### Step 1: Extract `AppMainContent.vue`

Status: Done

Move the `app-grid` content out of `App.vue` into `src/components/AppMainContent.vue`.

Scope:

- `PrimarySidebar`
- `LibraryContentLayout`
- `LibraryPanel`
- `WorkspaceView`
- `PluginSearchView`
- `DiscoverMusicView`
- `ArtistsView`
- `DownloadManagerView`
- `ThemeView`
- `PluginManagerView`
- `SettingsView`
- Library resize handle styles

Rules:

- Do not move state or business logic yet.
- Keep existing event names and behavior.
- `App.vue` still owns playback, lyrics, queue, download, search, and navigation state.
- `AppMainContent.vue` only renders the current main content and re-emits events.

Verify:

- `npm run build` passes.
- Library, discover, artists, downloads, themes, plugins, and settings views still switch through existing state.

### Step 2: Extract `AppLayout.vue`

Status: Pending

Move the outer app shell out of `App.vue` after Step 1 is stable.

Scope:

- `main.mono-window`
- `WindowControls`
- context menus
- `AppDialogs`
- `LyricsView`
- `AppMainContent`
- lyrics dock hot zone
- online toast
- `PlayerDock`

Rules:

- Do not introduce router in this step.
- Do not move playback, lyrics, or queue logic.
- `AppLayout.vue` should remain layout and event forwarding only.

Verify:

- `npm run build` passes.
- Lyrics page, PlayerDock, context menus, dialogs, and toast still render in the same layers.

### Step 3: Evaluate state extraction

Status: Pending

After layout components are stable, evaluate state extraction by responsibility:

- library view model
- download actions
- system media integration
- desktop lyrics integration
- online playback/search controller

## Progress Log

- 2026-07-22: Created plan. Starting Step 1.
- 2026-07-22: Step 1 done. Added `src/components/AppMainContent.vue`, moved the `app-grid` page dispatch template and library resize handle styles out of `App.vue`, kept state and business methods in `App.vue`, and verified with `npm run build`. `App.vue` is now 2048 lines.
