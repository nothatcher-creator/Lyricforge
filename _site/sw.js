const CACHE='lyricforge-v0.3.7';
const APP=[
  './','./index.html','./styles.css','./ui-polish.css','./manifest.webmanifest','./favicon.svg','./presets/catalog.json',
  './src/app.mjs','./src/presets/schema.mjs','./src/presets/storage.mjs','./src/presets/library.mjs','./src/editor/selection.mjs','./src/editor/transforms.mjs','./src/editor/timeline-tools.mjs','./src/core/model.mjs','./src/core/time.mjs','./src/core/history.mjs','./src/core/state.mjs','./src/core/snap.mjs','./src/core/gestures.mjs',
  './src/audio/analysis.mjs','./src/audio/engine.mjs','./src/lyrics/formats.mjs','./src/render/presets.mjs','./src/render/renderer.mjs','./src/render/web-fonts.mjs','./src/render/effects.mjs',
  './src/transcription/providers.mjs','./src/transcription/model-fetch.mjs','./src/transcription/whisper-worker.mjs','./src/storage/db.mjs','./src/storage/bundle.mjs','./src/export/exporter.mjs','./src/export/video-export.mjs'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request);
      if(response.ok){const clone=response.clone();const cache=await caches.open(CACHE);await cache.put(event.request,clone);}
      return response;
    }catch(error){
      const cached=await caches.match(event.request);
      if(cached)return cached;
      throw error;
    }
  })());
});
