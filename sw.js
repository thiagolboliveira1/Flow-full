self.addEventListener('install', e=>{
  e.waitUntil(caches.open('flow-full-v1').then(c=>c.addAll(['./','./index.html','./app.js','./firebase-config.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'])));
});
self.addEventListener('fetch', e=>{ e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request))); });