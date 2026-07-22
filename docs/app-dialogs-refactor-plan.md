# App Dialogs Refactor Plan

## Goal

Reduce `App.vue` responsibility by moving global dialog rendering into a dedicated component first, then moving dialog state and actions into composables step by step.

`App.vue` should keep application assembly, page routing, and wiring. Dialog components can stay globally mounted, but dialog business state and action methods should not keep growing inside `App.vue`.

## Scope

Included global dialogs:

- `TrackMetadataDialog`
- `AddToPlaylistDialog`
- `PlaylistDialog`
- `ScanDialog`

Not included in the first step:

- Context menus. They are floating menus, not standard dialogs, and should be handled in a separate `useContextMenus` step.
- Lyrics view dialogs. Those belong to `LyricsView` and its child components.
- Player dock popovers. Those belong to `PlayerDock` children.

## Steps

### Step 1: Extract `AppDialogs.vue`

Status: Done

Move only dialog template markup from `App.vue` into `src/components/AppDialogs.vue`.

Rules:

- Do not move business logic yet.
- Do not rename methods or state.
- Pass existing state as props.
- Re-emit existing dialog events back to `App.vue`.
- Keep behavior identical.

Verify:

- `npm run build` passes.
- `App.vue` no longer directly imports the four dialog components.
- The four dialogs are rendered through `AppDialogs.vue`.

### Step 2: Extract track metadata dialog logic

Status: Done

Move metadata dialog state/actions into `useTrackMetadataDialog.ts`.

Target state/actions:

- `metadataEditingTrack`
- `isSavingTrackMetadata`
- `trackMetadataError`
- `openTrackMetadataDialog`
- `closeTrackMetadataDialog`
- `saveTrackMetadata`
- `changeTrackCover`
- `refreshLocalTrackDuration`

Verify:

- Editing metadata works.
- Changing cover works.
- Refreshing duration works.
- `npm run build` passes.

### Step 3: Extract playlist dialogs logic

Status: Done

Move playlist creation/rename and add-to-playlist dialog state/actions into playlist composables.

Inspection result before the split:

- Playlist dialog state/actions are already outside `App.vue` in `src/composables/usePlaylistActions.ts`.
- `App.vue` only destructures the returned state/actions and passes them to `AppDialogs.vue`, `PrimarySidebar`, and context menus.
- No immediate `App.vue` migration is needed for playlist dialogs.
- `usePlaylistActions.ts` currently mixes playlist dialog state, context menu state, queue insertion actions, playlist CRUD, and open-folder actions. If this is optimized later, split by responsibility rather than moving anything back into `App.vue`.

Recommended follow-up:

- Playlist dialog state is now in `src/composables/usePlaylistDialogs.ts`.
- Context menu state is now in `src/composables/useContextMenus.ts`.
- Queue insertion helpers remain in `src/composables/usePlaylistActions.ts`.

Verify:

- Create playlist works.
- Rename playlist works.
- Add track to playlist works.
- `npm run build` passes.

### Step 4: Consolidate scan dialog logic

Status: Done

Move scan dialog open/close state into the existing scan composable if it fits the current structure.

Inspection result:

- Scan dialog state/actions are already in `src/composables/useScanFolders.ts`.
- `App.vue` only destructures scan state/actions and passes them to `AppDialogs.vue` / `LibraryPanel`.
- No code migration was needed for this step.

Verify:

- Open scan dialog works.
- Add/remove folders works.
- Confirm/cancel scan works.
- `npm run build` passes.

### Step 5: Handle context menus separately

Status: Partially Done

Evaluate `PlaylistContextMenu` and `TrackContextMenu` separately. If extracted, use `useContextMenus.ts` rather than mixing menus with dialogs.

Current result:

- `playlistContextMenu` and `trackContextMenu` state moved to `src/composables/useContextMenus.ts`.
- Basic open/close menu actions moved to `useContextMenus.ts`.
- Menu business actions still stay in `usePlaylistActions.ts`, because queue insertion, playlist mutation, and open-folder behavior belong to action handling rather than pure menu state.

Verify:

- Track right-click actions work.
- Playlist right-click actions work.
- `npm run build` passes.

### Additional Step: Extract online toast state

Status: Done

Move global online toast message state and timer handling out of `App.vue`.

Result:

- Added `src/composables/useOnlineToast.ts`.
- Moved `onlineToastMessage`, `onlineToastVariant`, timer cleanup, show, and close actions into the composable.
- Kept existing `showOnlineToast` / `closeOnlineToast` usage in `App.vue` unchanged through destructuring.

Verify:

- `npm run build` passes.

## Progress Log

- 2026-07-22: Created plan. Starting Step 1.
- 2026-07-22: Step 1 done. Added `src/components/AppDialogs.vue`, moved the four global dialog render blocks out of `App.vue`, kept existing dialog state and business methods in `App.vue`, and verified with `npm run build`.
- 2026-07-22: Step 2 done. Added `src/composables/useTrackMetadataDialog.ts`, moved metadata dialog state/actions and track metadata sync helpers out of `App.vue`, kept existing behavior and verified with `npm run build`.
- 2026-07-22: Step 3 inspection done. Playlist dialog state/actions are already in `usePlaylistActions.ts`; no code migration was made. Documented that the next useful cleanup is separating context menus and queue actions from playlist dialog/CRUD responsibilities.
- 2026-07-22: Step 3 follow-up done. Added `src/composables/usePlaylistDialogs.ts` for playlist dialog state, added `src/composables/useContextMenus.ts` for context menu state, kept queue insertion actions in `usePlaylistActions.ts`, and verified with `npm run build`.
- 2026-07-22: Step 4 inspection done. Scan dialog state/actions are already in `useScanFolders.ts`; no code migration was needed.
- 2026-07-22: Additional App cleanup done. Added `src/composables/useOnlineToast.ts`, moved toast state/timer handling out of `App.vue`, and verified with `npm run build`.
