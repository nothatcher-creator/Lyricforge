# `.lyricpreset` format

A `.lyricpreset` file is UTF-8, **data-only** JSON. LyricForge never evaluates preset files as JavaScript or HTML.

Current signature: `lyricforge-preset`  
Current `schemaVersion`: `1`  
Maximum preset size: `262144` bytes.

Minimal example:

```json
{
  "signature": "lyricforge-preset",
  "schemaVersion": 1,
  "id": "my-preset",
  "name": "My Preset",
  "author": "Creator",
  "description": "A custom LyricForge look.",
  "category": "Custom",
  "tags": ["custom"],
  "version": "1.0.0",
  "minAppVersion": "0.3.7",
  "style": {
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontSize": 76,
    "activeColor": "#ff365c",
    "entrance": {"name": "fade", "durationMs": 280, "intensity": 1},
    "idle": {"name": "none", "durationMs": 1000, "intensity": 1},
    "exit": {"name": "fade", "durationMs": 240, "intensity": 1}
  },
  "background": {"type": "gradient", "value": ["#090b13", "#18122d"]},
  "visualizer": {"type": "bars", "enabled": false},
  "videoEffects": {}
}
```

`style` may reference a known/project-supported **font** family or font id, but preset files do not embed font binaries. `background`, visualizer and `videoEffects` fields are normalized to allowlisted data/ranges by `src/presets/schema.mjs`.

Security restrictions: scripts, executable markup, inline event handlers, `javascript:` URLs, HTML payloads, embedded media/font bytes, credentials and arbitrary executable data are forbidden. Unknown keys are stripped during normalization. The catalog provider also enforces HTTPS outside localhost and download-size caps.

Imported duplicate ids are only replaced when the user chooses replacement; otherwise a compatible local variant id can be generated. Applying a preset stores resolved visual values in the project, so uninstalling the library item does not alter already-styled projects.

Recommended MIME is `application/json`; the portable extension is `.lyricpreset`.
