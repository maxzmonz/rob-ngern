/* รอบเงิน: public application files only. Never cache auth/API/ledger responses. */
'use strict';
const VERSION = 'v9-eec658f66d5d';
const ROOT = self.registration.scope;
const SCOPE = new URL(ROOT);
const PREFIX = 'rob-ngern-shell:' + SCOPE.pathname + ':';
const SHELL = PREFIX + VERSION;
const PUBLIC = PREFIX + 'public-v1';
const APP = new URL('index.html', ROOT).href;
const FILES = ['index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'].map(p=>new URL(p,ROOT).href);
const WARM = [
 'https://cdn.jsdelivr.net/npm/chart.js@4.4.8/dist/chart.umd.min.js',
 'https://cdn.jsdelivr.net/npm/sweetalert2@11.17.2/dist/sweetalert2.all.min.js',
 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.3.3',
 'https://cdn.jsdelivr.net/npm/daisyui@5.7.46/daisyui.css',
 'https://cdn.jsdelivr.net/npm/lucide@1.48.0/dist/umd/lucide.min.js',
 'https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap',
 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js',
 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js',
 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'
];
function isPublicAsset(url){
 return (url.origin==='https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/12.19.0/')) ||
   (url.origin==='https://fonts.gstatic.com' && url.pathname.startsWith('/s/')) ||
   (url.origin==='https://fonts.googleapis.com' && url.pathname==='/css2') || WARM.includes(url.href);
}
async function timedFetch(request,ms=5000){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);
 try{return await fetch(request,{signal:controller.signal});}finally{clearTimeout(timer);}
}
async function safePut(cache,key,response){
 if(!response.ok && response.type!=='opaque')return;
 try{await cache.put(key,response.clone());}catch(_){ /* Quota must not break online use. */ }
}
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(SHELL);
  for(const url of FILES){
   const response=await timedFetch(new Request(url,{cache:'reload'}),15000);
   if(!response.ok || (url===APP && !response.headers.get('content-type')?.includes('text/html')))throw Error('Application files not ready');
   await cache.put(url,response);
  }
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith(PREFIX)&&n!==SHELL&&n!==PUBLIC).map(n=>caches.delete(n)));
  await self.clients.claim();
 })());
});
async function navigation(request){
 const cache=await caches.open(SHELL);
 try{
  const response=await timedFetch(request,4000);
  if(!response.ok)throw Error('Network response '+response.status);
  if(response.headers.get('content-type')?.includes('text/html'))await safePut(cache,APP,response);
  return response;
 }catch(_){return await cache.match(APP) || new Response('กรุณาออนไลน์และเปิดรอบเงินหนึ่งครั้งก่อนใช้งานออฟไลน์',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});}
}
async function cachedAsset(request,name){
 const cache=await caches.open(name),hit=await cache.match(request);
 if(hit)return hit;
 const response=await timedFetch(request);
 await safePut(cache,request,response);return response;
}
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);
 if(url.origin===SCOPE.origin&&url.pathname.startsWith(SCOPE.pathname)){
  if(req.mode==='navigate'){event.respondWith(navigation(req));return;}
  if(FILES.includes(url.href)){event.respondWith(cachedAsset(req,SHELL));return;}
 }
 if(isPublicAsset(url))event.respondWith(cachedAsset(req,PUBLIC));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='WARM_PUBLIC_ASSETS')event.waitUntil(Promise.allSettled(WARM.map(url=>cachedAsset(new Request(url,{mode:'cors',credentials:'omit'}),PUBLIC))));
});

self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const client of list)if(client.url.startsWith(ROOT)){await client.navigate(new URL('./#personal',ROOT).href);return client.focus();}return self.clients.openWindow(new URL('./#personal',ROOT).href);})());});
