const CACHE_NAME="luminaf-static-v3";
const APP_BASE=new URL("./",self.location.href).href;
const APP_SHELL=["offline.html","manifest.webmanifest","icon.svg"].map(path=>new URL(path,APP_BASE).href);
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)));self.skipWaiting();});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))));self.clients.claim();});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(!url.pathname.startsWith(new URL(APP_BASE).pathname))return;
 if(request.mode==="navigate"){event.respondWith(fetch(request).catch(()=>caches.match(new URL("offline.html",APP_BASE).href)));return;}
 if(url.pathname.includes("/api/"))return;
 if(!/\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname))return;
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&response.type==="basic"){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}return response;})));
});
self.addEventListener("push",event=>{
 let payload={title:"Luminaf",body:"A gentle reminder for your wellness routine.",url:APP_BASE};
 try{if(event.data){const value=event.data.json();payload={...payload,...value};}}catch{if(event.data)payload.body=event.data.text();}
 event.waitUntil(self.registration.showNotification(payload.title||"Luminaf",{body:payload.body||"A gentle reminder.",icon:new URL("icon.svg",APP_BASE).href,badge:new URL("icon.svg",APP_BASE).href,tag:payload.notificationId||"luminaf-reminder",data:{url:payload.url||APP_BASE}}));
});
self.addEventListener("notificationclick",event=>{event.notification.close();const target=new URL(event.notification.data?.url||APP_BASE,self.location.origin).href;event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{const existing=clients.find(client=>client.url.startsWith(self.location.origin));if(existing){existing.navigate(target);return existing.focus();}return self.clients.openWindow(target);}));});
