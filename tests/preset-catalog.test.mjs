import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {validatePresetRecord} from '../src/presets/schema.mjs';

const root=new URL('../',import.meta.url);
test('first-party catalog entries are unique and match valid local preset files',async()=>{
  const catalog=JSON.parse(await readFile(new URL('presets/catalog.json',root),'utf8'));
  assert.equal(catalog.signature,'lyricforge-preset-catalog');
  assert.equal(catalog.schemaVersion,1);
  assert.ok(catalog.entries.length>=8);
  assert.equal(new Set(catalog.entries.map(e=>e.id)).size,catalog.entries.length);
  for(const entry of catalog.entries){
    assert.ok(entry.id&&entry.name&&entry.version);
    assert.ok(Array.isArray(entry.tags)&&entry.tags.every(x=>typeof x==='string'));
    assert.equal(typeof entry.category,'string');
    assert.ok(!/^(?:http):\/\//i.test(entry.downloadUrl));
    const u=new URL(entry.downloadUrl,new URL('presets/catalog.json',root));
    const record=validatePresetRecord(await readFile(u,'utf8'));
    assert.equal(record.id,entry.id);assert.equal(record.name,entry.name);assert.equal(record.version,entry.version);
  }
});

test('catalog library contains the documented starter presets',async()=>{
  const names=(await readdir(new URL('presets/library/',root))).join('\n').toLowerCase();
  for(const key of ['cyberpunk','phonk','vintage','metalcore','dreamy','minimal','western','documentary'])assert.match(names,new RegExp(key));
});
