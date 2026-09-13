# Authoring and contributing presets

Create a look in LyricForge, open **Presets**, and use **Export Preset** to create a `.lyricpreset` file. Re-import it with **Import Preset** to verify that the file validates and installs correctly.

For a first-party catalog contribution:

1. Validate the preset locally and ensure it contains configuration data only.
2. Add the file under `presets/library/<id>.lyricpreset`.
3. Add matching id/name/version metadata to `presets/catalog.json` with a relative `downloadUrl`.
4. Do not add third-party font binaries, music, videos, images, scripts, API keys or credentials.
5. Run `node --test tests/preset-schema.test.mjs tests/preset-library.test.mjs tests/preset-catalog.test.mjs`.
6. Run the full `npm test` suite and submit a pull request.

The first-party catalog is static and GitHub-Pages friendly. `src/presets/library.mjs` treats it and every downloaded preset as untrusted input, enforces size/URL rules, and validates records before installation.
