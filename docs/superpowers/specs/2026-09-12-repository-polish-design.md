# LyricForge Repository Polish Design

Date: 2026-09-12
Status: Approved

## Goal

Make the public `nothatcher-creator/Lyricforge` repository useful to users and contributors while v0.3.7 adds downloadable presets and editor tools. The repository should explain what LyricForge does, how to run/test it, how presets work, how to contribute presets/code, and how to report security issues without inventing licensing terms the owner has not chosen.

## Source completeness

The public repository must contain the same human-readable source package that is used to build and test the release. At minimum this includes `styles.css`, `src/app.mjs`, the complete `tests/` directory, `tools/dev-server.mjs`, `CHANGELOG.md`, and `IMPLEMENTATION_STATUS.md` in addition to the existing modular `src/` files. Generated deployment fragments may remain for compatibility during the transition, but they must not be the only copy of core application source.

`package.json` scripts must work from a normal clone. `npm run dev`, `npm test`, and `npm run test:browser` must reference files that actually exist in the repository. The v0.3.7 release process should sync direct source files from the exact fresh-ZIP build that passed verification, then make GitHub Pages verify those direct files by hash before deployment. If the existing reconstruction workflow is still needed during the migration, it may remain temporarily, but the direct source files are the canonical public copy.

## Public repository surface

Add a current `README.md` with the live GitHub Pages demo, current release/download guidance, screenshots or screenshot placeholders only when committed image assets exist, feature overview, Android portrait support, local-first/privacy explanation, browser requirements, quick start, tests, project layout, preset-library overview, roadmap, and contribution links.

Add `CONTRIBUTING.md` with environment setup, coding/testing expectations, TDD expectations for behavior changes, mobile/Chrome regression requirements, commit/PR guidance, and preset contribution flow.

Add `SECURITY.md` describing responsible disclosure, what information to include, supported release expectations, and a clear warning not to post secrets/API keys in public issues. Do not promise a private email address or SLA that has not been provided by the owner; direct reporters to GitHub private vulnerability reporting if enabled, otherwise to open a minimal non-sensitive issue asking for a private contact path.

Do not add a `LICENSE` file until the owner explicitly chooses a license.

## GitHub contribution templates

Add issue forms for bugs and feature requests plus a pull-request template. Bug reports should capture browser/device, orientation, exact LyricForge version, reproduction steps, expected/actual result, console error, and whether the issue occurs on the GitHub Pages build. Feature requests should capture user problem, proposed workflow, mobile impact, and alternatives.

## Preset documentation and catalog

Add documentation for `.lyricpreset` authoring and the first-party catalog format, matching the v0.3.7 schema implementation exactly. Document data-only/security constraints, compatibility metadata, allowed font references, effect fields, install/update behavior, and contribution validation.

Create a versioned first-party preset catalog under `presets/catalog.json` plus individual `.lyricpreset` files under `presets/library/`. Initial entries should be based on existing factory presets and only contain original/configuration data; do not bundle third-party font binaries or copyrighted media.

The catalog should be static-host friendly so GitHub Pages can serve it directly. Preset contributions must pass automated schema/catalog validation tests before merge.

## Release/docs hygiene

Normalize the changelog so versions are in descending order with one heading per release. Add v0.3.7 release notes when implementation is complete. Update `IMPLEMENTATION_STATUS.md` to reflect actual, tested functionality rather than aspirational work.

Document the current static/dependency-free development flow (`npm run dev`, Node 20+) and Chrome browser test invocation. Keep documentation values synchronized with `package.json` and the service-worker/app version.

## Repository constraints

- No license choice is made automatically.
- No secrets, API keys, personal contact details, or private endpoints are committed.
- No fake badges or claims of CI/test status that are not backed by repository automation.
- No screenshot links point to uncommitted/local-only files.
- Documentation must distinguish built-in local Whisper from optional remote transcription.
- Preset docs must be generated from or cross-checked against the actual v0.3.7 schema names before release.

## Acceptance criteria

1. A normal repository clone contains the complete runnable/testable source package and `npm run dev`, `npm test`, and `npm run test:browser` resolve to real files.
2. GitHub visitors can understand LyricForge and run it locally from the README alone.
3. Contributors can submit a bug, feature, code change, or preset using documented workflows.
4. `.lyricpreset` and catalog formats are documented and backed by example files plus automated validation.
5. Changelog/status docs accurately describe the release.
6. The repository contains no invented license, secret, broken local-only links, or unsupported compatibility claims.
