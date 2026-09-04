const CACHE='cbta241-shell-v2';
const SAFE=['/offline.html','/institution/cbta241-logo.png','/institution/icon-192.png','/institution/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SAFE)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin)return;
  const sensitive=u.pathname.startsWith('/api/')||u.pathname.startsWith('/alumno')||u.pathname.startsWith('/docente')||u.pathname.startsWith('/control')||u.pathname.startsWith('/admin')||u.pathname.includes('verificar');
  if(sensitive){e.respondWith(fetch(r));return;}
  if(SAFE.includes(u.pathname)){e.respondWith(caches.match(r).then(c=>c||fetch(r)));return;}
  e.respondWith(fetch(r).catch(()=>caches.match('/offline.html')));
});
