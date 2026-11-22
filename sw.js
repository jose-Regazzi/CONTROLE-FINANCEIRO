const C='cf-v3';
const SHELL=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url);
  if(u.origin===location.origin){ // rede primeiro (pega atualizações), cache se offline
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
  } else if(u.hostname.includes('sheetjs')){ // leitor de Excel: cache após 1º uso
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const cp=n.clone();caches.open(C).then(c=>c.put(e.request,cp));return n;})));
  }
});
// ---- alertas em segundo plano (Android/Chrome com app instalado) ----
function idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open('cf',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function kvGet(k){ const db=await idb(); return new Promise(res=>{ const q=db.transaction('kv').objectStore('kv').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>res(null); }); }
async function kvPut(k,v){ const db=await idb(); return new Promise(res=>{ const tx=db.transaction('kv','readwrite'); tx.objectStore('kv').put(v,k); tx.oncomplete=()=>res(); }); }
const iso=d=>d.toISOString().slice(0,10);
async function runAlerts(){
  const list=(await kvGet('alerts'))||[]; const shown=(await kvGet('shown'))||{}; const today=iso(new Date());
  for(const a of list){
    if(today<a.from) continue;
    const k=a.id+'_'+today; if(shown[k]) continue;
    const late=today>a.due, hoje=today===a.due;
    await self.registration.showNotification(late?`⚠ ${a.title} — ATRASADO`:hoje?`${a.title} — vence HOJE`:`${a.title} — vence ${a.due.slice(8,10)}/${a.due.slice(5,7)}`,
      {body:`Valor ${a.val} · Controle Financeiro`,tag:a.id,icon:'icon-192.png',badge:'icon-192.png'});
    shown[k]=1;
  }
  for(const k of Object.keys(shown)) if(!k.endsWith(today)) delete shown[k];
  await kvPut('shown',shown);
}
self.addEventListener('periodicsync',e=>{ if(e.tag==='cf-alerts') e.waitUntil(runAlerts()); });
self.addEventListener('notificationclick',e=>{ e.notification.close(); e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{ for(const w of ws){ if('focus' in w) return w.focus(); } return clients.openWindow('./'); })); });
