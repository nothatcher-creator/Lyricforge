import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const exists=async p=>{await access(new URL(p,root));return true};

test('normal clone contains complete runnable source and script entrypoints',async()=>{
  for(const p of ['styles.css','ui-polish.css','src/app.mjs','tools/dev-server.mjs','CHANGELOG.md','IMPLEMENTATION_STATUS.md','tests/shell.test.mjs','tests/browser-layout.test.mjs','tests/workflow.test.mjs'])await exists(p);
  const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
  for(const script of ['test','dev','test:browser'])assert.ok(pkg.scripts[script],`missing ${script} script`);
  assert.equal(pkg.version,'0.3.7');
});

test('release manifest hashes critical canonical runtime files',async()=>{
  const manifest=JSON.parse(await readFile(new URL('release-manifest.json',root),'utf8'));
  assert.equal(manifest.version,'0.3.7');
  for(const p of ['index.html','styles.css','ui-polish.css','src/app.mjs','src/core/model.mjs','src/render/renderer.mjs','sw.js','package.json']){
    const data=await readFile(new URL(p,root));const hash=createHash('sha256').update(data).digest('hex');assert.equal(manifest.files[p],hash,`${p} hash mismatch`);
  }
});
