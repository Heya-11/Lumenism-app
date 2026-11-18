/* Lumenism service worker: app shell (same-origin) = stale-while-revalidate, AI engines/models/fonts = cache-first forever */
const VER='lumen-app-v2';
const PACK_CACHE='lumen-models-v1';
const MODEL_HOSTS=/^(cdn\.jsdelivr\.net|storage\.googleapis\.com|huggingface\.co|[a-z0-9-]+\.hf\.co|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
const SHELL=['./','index.html','manifest.webmanifest','css/app.css','assets/icon-192.png','assets/icon-512.png',
  ...['geo','shaders','warp','renderer','io','inpaint','hdr','core','controls','panels','tools','auto','ai','aifeat','aifeat2','sky','aiui','mobile','pwa','main'].map(n=>`js/${n}.js`)];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VER).then(c=>c.addAll(SHELL)).catch(()=>{}));});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('lumen-app-')&&k!==VER)await caches.delete(k);await self.clients.claim();})());});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);
  if(url.origin===location.origin){
    if(url.pathname.includes('/offline/'))return;
    e.respondWith((async()=>{const c=await caches.open(VER);const key=req.mode==='navigate'?'index.html':req;
      const hit=await c.match(key,{ignoreSearch:true});
      const net=fetch(req).then(r=>{if(r.ok&&r.type==='basic')c.put(key,r.clone());return r;}).catch(()=>null);
      if(hit){e.waitUntil(net);return hit;}const r=await net;return r||new Response('오프라인이에요',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});})());
    return;}
  if(!MODEL_HOSTS.test(url.hostname))return;
  if(req.headers.has('range'))return;
  e.respondWith((async()=>{const c=await caches.open(PACK_CACHE);const hit=await c.match(req.url);if(hit)return hit;
    try{const r=await fetch(req);if(r.ok||r.type==='opaque'){const cl=r.clone();e.waitUntil(c.put(req.url,cl).catch(()=>{}));}return r;}
    catch(err){return Response.error();}})());});
