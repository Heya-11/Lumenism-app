/* Lumenism service worker: app shell (same-origin) = stale-while-revalidate, AI engines/models/fonts = cache-first forever */
const VER='lumen-app-v9';
const PACK_CACHE='lumen-models-v1';
const MODEL_HOSTS=/^(cdn\.jsdelivr\.net|storage\.googleapis\.com|huggingface\.co|[a-z0-9-]+\.hf\.co|fonts\.googleapis\.com|fonts\.gstatic\.com)$/;
const SHELL=['./','index.html','manifest.webmanifest','css/app.css','assets/icon-192.png','assets/icon-512.png',
  ...['geo','shaders','warp','renderer','io','inpaint','hdr','core','controls','panels','tools','auto','ai','faces','aifeat','aifeat2','sky','aiui','mobile','pwa','main'].map(n=>`js/${n}.js`)];
self.addEventListener('install',e=>{/* all-or-nothing: the new version only installs once every app file is downloaded */
  e.waitUntil(caches.open(VER).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))));});
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('lumen-app-')&&k!==VER)await caches.delete(k);await self.clients.claim();})());});
/* Android share sheet (갤러리 → 공유 → Lumenism): keep the shared files and open the app */
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='POST'||!new URL(req.url).pathname.endsWith('/share-target'))return;
  e.respondWith((async()=>{try{const fd=await req.formData();const files=fd.getAll('photos').filter(f=>f&&f.size);const c=await caches.open('lumen-share');
      for(const k of await c.keys())await c.delete(k);
      for(let i=0;i<files.length;i++){const f=files[i];await c.put(new URL('share/'+i,self.registration.scope).href,new Response(f,{headers:{'Content-Type':f.type||'application/octet-stream','X-Name':encodeURIComponent(f.name||('shared_'+i+'.jpg'))}}));}}
    catch(err){}
    return Response.redirect(new URL('./?shared='+Date.now(),self.registration.scope).href,303);})());});
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);
  if(url.origin===location.origin){
    if(url.pathname.includes('/offline/'))return;
    /* app files come only from this version's cache, so old and new files never mix; updates arrive as a whole new version */
    e.respondWith((async()=>{const c=await caches.open(VER);const key=req.mode==='navigate'?'index.html':req;
      const hit=await c.match(key,{ignoreSearch:true});if(hit)return hit;
      try{const r=await fetch(req);if(r.ok&&r.type==='basic'&&req.mode!=='navigate')c.put(req,r.clone());return r;}
      catch(err){return new Response('오프라인이에요',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}})());
    return;}
  if(!MODEL_HOSTS.test(url.hostname))return;
  if(req.headers.has('range'))return;
  e.respondWith((async()=>{const c=await caches.open(PACK_CACHE);const hit=await c.match(req.url);if(hit)return hit;
    try{const r=await fetch(req);if(r.ok||r.type==='opaque'){const cl=r.clone();e.waitUntil(c.put(req.url,cl).catch(()=>{}));}return r;}
    catch(err){return Response.error();}})());});
