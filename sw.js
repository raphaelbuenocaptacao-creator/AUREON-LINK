const CACHE_PREFIX='aureon-link-';
const CACHE_NAME=`${CACHE_PREFIX}v2-private-safe-raster-shell`;
const SHELL=['./','./index.html','./manifest.webmanifest','./icon.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'];
const PRIVATE_PATHS=/\/(api|auth|login|logout|session|token|account|profile|admin)(\/|$)/i;
const SENSITIVE_QUERY=/(token|auth|session|password|senha|secret|key|code)/i;
function requestIsPublic(req){
  if(req.method!=='GET')return false;
  if(req.headers.has('authorization')||req.headers.has('cookie')||req.headers.has('range'))return false;
  const u=new URL(req.url);
  if(PRIVATE_PATHS.test(u.pathname)||SENSITIVE_QUERY.test(u.search))return false;
  return u.origin===self.location.origin;
}
function responseIsCacheable(res){
  if(!res||!res.ok||res.redirected||res.status===206)return false;
  const cc=(res.headers.get('cache-control')||'').toLowerCase();
  if(cc.includes('private')||cc.includes('no-store'))return false;
  if(res.headers.has('set-cookie')||res.headers.has('content-range'))return false;
  const vary=(res.headers.get('vary')||'').toLowerCase();
  if(vary==='*'||vary.includes('cookie')||vary.includes('authorization'))return false;
  return true;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  for(const path of SHELL){
    try{
      const res=await fetch(new Request(new URL(path,self.registration.scope),{credentials:'omit',cache:'reload',redirect:'error'}));
      if(responseIsCacheable(res))await cache.put(path,res.clone());
    }catch{}
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const req=event.request;if(!requestIsPublic(req))return;
  const isNavigation=req.mode==='navigate';
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(req);
      if(responseIsCacheable(fresh)&&!isNavigation){const cache=await caches.open(CACHE_NAME);await cache.put(req,fresh.clone());}
      return fresh;
    }catch{
      const cached=await caches.match(req);if(cached)return cached;
      if(isNavigation)return (await caches.match('./index.html'))||(await caches.match('./'))||Response.error();
      return Response.error();
    }
  })());
});