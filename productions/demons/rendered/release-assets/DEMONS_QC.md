# Delivery checks

Rendered picture: **1920 × 1080, H.264, yuv420p, 30 FPS, 11,042 frames, 368.066667 s**.

- The complete exported MP4 decoded from beginning to end with FFmpeg and no reported errors.
- The original stereo 44,100 Hz AAC is stream-copied; all 15,851 source audio packets are retained.
- Compressed audio equality: **True**.
- Decoded PCM equality: **True**.
- Source M4A SHA-256: `77a6d0fbbaec6df6ca168305e18e67595574fef87ea285558ed6af9645589cb1`.
- Reference coverage: all **285 words**, in order, across **73 cues**. Only the three recording-supported spelling examples changed: creams → screams, Doul → soul, fro → for.
- `SOLO` is excluded. No lyric cue begins in either instrumental solo.
- All word intervals are positive and ordered. Lyric endings stay within the song.
- All **285 text boxes** pass render-layout safety: horizontal bounds **266–1654 px**, maximum animated bottom **940 px**, inside the 1920 × 1080 canvas.
- The **43 camera setups** form a continuous picture timeline; all 12 environment assets resolve.
- A 12-second 1080p representative excerpt was rendered and decoded before the full render. Full-resolution frames were inspected across 15 positions, including the credits, chorus, ritual, rain, doors, and final release. Typography orientation and baseline issues were corrected.
- The editor project passes LyricForge's actual `readProject` validator: 285 words, 43 scenes, valid local asset URLs.
- Opening and closing credits use the requested artist and creator names.

## Remaining listening review

The source's dense accompaniment obscures several sung phrases. Notes on eight cues in `lyric_timeline.json` retain that uncertainty. Automatic timing and text-order checks do **not** verify every phonetic boundary by ear. Those cues should be checked by the songwriter before treating this as an approved official release.

The visual treatment uses generated still environment plates with layered 2.5D animation, plus procedural 3D fragments, rather than full generated moving footage of each environment. See `README.md` for the exact rendering workflow.
