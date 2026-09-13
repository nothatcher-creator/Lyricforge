#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

node --input-type=module <<'NODE'
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const manifest=JSON.parse(await readFile('release-manifest.json','utf8'));
if(manifest.version!=='0.3.7')throw new Error(`Unexpected release manifest version ${manifest.version}`);
for(const [path,expected] of Object.entries(manifest.files||{})){
  const actual=createHash('sha256').update(await readFile(path)).digest('hex');
  if(actual!==expected)throw new Error(`Release hash mismatch for ${path}`);
}
console.log(`Verified ${Object.keys(manifest.files||{}).length} release hashes for v${manifest.version}`);
NODE

rm -rf _site
mkdir -p _site
cp index.html styles.css ui-polish.css favicon.svg manifest.webmanifest sw.js _site/
cp -R src _site/src
cp -R presets _site/presets
touch _site/.nojekyll

test -f _site/src/app.mjs
test -f _site/src/presets/schema.mjs
test -f _site/src/editor/timeline-tools.mjs
test -f _site/presets/catalog.json
grep -q 'lyricforge-v0.3.7' _site/sw.js
grep -q 'data-action="timeline-razor"' _site/index.html
grep -q 'Import Preset' _site/src/app.mjs
