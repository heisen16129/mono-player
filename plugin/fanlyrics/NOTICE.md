# Attribution and migration notes

Fan Lyrics is the standalone fan-layout edition extracted from BetterLyrics for
Mono. It shares adaptation source at build time; its bundled renderer requires
no other installed plugin. The upstream attribution and GPL terms below apply.

BetterLyrics for Mono is a browser implementation of the BetterLyrics lyrics page.
It is not an official BetterLyrics release and does not embed the WinUI application.

- Upstream: https://github.com/jayfunc/BetterLyrics
- Author: jayfunc and BetterLyrics contributors
- Reference branch: `dev`
- Reference commit: `3dd950d55a046b1ff7d4ad1831de3eb05506fc56`
- License: GPL-3.0-only; the upstream license text is included in `LICENSE`.
- Mono adaptation: Mono contributors, 2026. Adaptation sources and the bundled
  module in this directory are provided under GPL-3.0-only.

References inspected at the commit above:

- `BetterLyrics.Core/Helpers/Lyrics/LyricsAnimator.cs`: viewport-normalized fan
  angles, 75–100% line scale, 450 ms character rise from a lowered baseline,
  syllable-length glow/scale attack and up to 350 ms release, played-prefix glow.
- `BetterLyrics.Core/Helpers/EasingHelper.cs` and `Constants/Time.cs`: sine-out
  interpolation and animation durations. These rules were adapted in 1.1.5.

- `docs/assets/screenshots/std.png` and `narrow.png`: cover, metadata and lyrics layout.
- `BetterLyrics.Core/Models/Settings/LyricsEffectSettings.cs`: 500 ms scroll,
  700 ms long-syllable threshold, 115% scale and 8 px glow defaults.
- `BetterLyrics.Core/Models/Settings/LyricsStyleSettings.cs`: left alignment,
  unplayed text opacity, line spacing and secondary text hierarchy.
- `BetterLyrics.WinUI3/BetterLyrics.WinUI3/Views/NowPlayingPage.xaml`:
  album art and track information regions.
- `BetterLyrics.WinUI3/BetterLyrics.WinUI3/Renderer/LyricsRenderer/`:
  `LyricsRenderer.cs`, `LyricsLineRendererBase.cs` and
  `HorizontalLyricsLineRenderer.cs`: focused positioning, played text masks,
  per-syllable floating, scaling and glow.

The source paths beginning with `BetterLyrics.Core` or `BetterLyrics.WinUI3`
are relative to upstream `src/BetterLyrics.DotNet/`.

The Mono version reimplements these behaviors using DOM/CSS and a playback clock.
CSS cover layers approximate the fluid backdrop; they do not port the original
Win2D fluid shader. Version 1.1 adds browser implementations of fan layout,
vertical lyrics and fixed 3D perspective, plus adjustable word glow and float.
These approximate the native rendering; automatic audio-driven 3D, the original
native window modes, spectrum, translation providers and lyric cards remain outside scope.
No upstream screenshots, album art, fonts, or music are distributed here. The
preview contains original fictional text and a generated vector test cover.
