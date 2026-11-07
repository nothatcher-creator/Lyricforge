# Test media license

`studio-test.wav` is a two-second synthesized 220 Hz sine tone with fade-in/out, generated for this test suite using FFmpeg's lavfi sine generator. `studio-test.mp3` is its MP3 encoding. The original test phrase in `studio-test.lrc` is “Signal in motion” with explicitly authored test cues. These fixtures contain no third-party audio, images, recordings or text; they are dedicated to the public domain under CC0-1.0. They are timing fixtures, not a claim of vocal forced alignment.

Regenerate WAV with:

```sh
ffmpeg -f lavfi -i 'sine=frequency=220:sample_rate=44100:duration=2' -af 'afade=t=in:d=0.05,afade=t=out:st=1.8:d=0.2' -c:a pcm_s16le tests/fixtures/studio-test.wav -y
ffmpeg -i tests/fixtures/studio-test.wav -c:a libmp3lame -q:a 4 tests/fixtures/studio-test.mp3 -y
```

`studio-background.mp4` is a two-second 320×180 H.264 test pattern generated entirely by FFmpeg's `testsrc2` generator. `studio-short.wav` is a one-second 330 Hz generated sine tone. Both are original generated test media dedicated under CC0-1.0, alongside their authored lyric cue files. They verify video-background decoding and short Full HD/vertical exports without third-party footage.
