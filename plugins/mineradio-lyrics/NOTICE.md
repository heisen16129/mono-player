# Mineradio Lyrics Renderer

This plugin contains code adapted from [Mineradio](https://github.com/XxHuberrr/Mineradio),
Copyright (c) Mineradio contributors, licensed under GPL-3.0-only.

The vendored portions include the Mineradio visual runtime used by the playback
surface: cover particles and presets, stage lyrics, camera motion, beat analysis,
ripples, floating particles, cover-depth processing, control-glass effects, and
the corresponding scoped styles. Source-section markers are retained in
`src/vendor/mineradio/engine.js` and its generated parts.

The Mono host integration, serializable playback clock, five-band spectrum adapter,
renderer lifecycle, queue, controls, and settings shell are modifications for Mono Player.

See `LICENSE` for the full GNU General Public License version 3 terms.
