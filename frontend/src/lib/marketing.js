// No names, email addresses, telephone numbers or raw query strings in analytics.
let config={};
let initializing;
let ready=false;
const recentEvents=new Map();
export const marketingReady=()=>ready;
const listeners=new Set();
const read = key => {try{return JSON.parse(sessionStorage.getItem(key)||'null');}catch{return null;}};
const save = (key,value) => {try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}};
const consent = () => {try{return JSON.parse(localStorage.getItem('circulo-consent')||'null');}catch{return null;}};
const uuid=()=>crypto.randomUUID();
const label=value=>/^[\w .:/-]{1,120}$/.test(value||'')?value:'';
const cleanPath=()=>location.pathname;
const externalReferrer=()=>{try{const u=new URL(document.referrer);return u.hostname!==location.hostname?u.hostname:'';}catch{return '';}};
export function captureAttribution() {
 if(!consent()?.analytics&&!consent()?.marketing)return {};
 const params=new URLSearchParams(location.search);
 const touch=Object.fromEntries(['source','medium','campaign','content','term'].map(k=>[k,label(params.get(`utm_${k}`))]).filter(([,v])=>v));
 const current=read('circulo-attribution')||{};
 if(!current.first) current.first=Object.keys(touch).length?touch:{source:externalReferrer()||'directo'};
 if(Object.keys(touch).length) current.latest=touch;
 save('circulo-attribution',current); return current;
}
export function attribution() {
 const a=captureAttribution(), e=config.experiment;
 if(consent()?.analytics && e?.active && e.path===location.pathname) {
  let variant=read(`circulo-ab-${e.id}`);
  if(!['A','B'].includes(variant)){variant=crypto.getRandomValues(new Uint8Array(1))[0]<128?'A':'B';save(`circulo-ab-${e.id}`,variant);}
  return {...a,path:cleanPath(),experiment:e.id,variant};
 }
 return {...a,path:cleanPath()};
}
function installTags() {
 const c=consent();
 if(c?.analytics && /^G-[A-Z0-9]+$/.test(config.ga4Id) && !document.getElementById('circulo-ga4')) {
  window.dataLayer=window.dataLayer||[];
  window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('js',new Date());
  window.gtag('config',config.ga4Id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false});
  const s=document.createElement('script');s.id='circulo-ga4';s.async=true;s.src=`https://www.googletagmanager.com/gtag/js?id=${config.ga4Id}`;document.head.append(s);
 }
 if(c?.marketing && /^\d+$/.test(config.metaPixelId) && !document.getElementById('circulo-meta')) {
  const fbq=function(){fbq.callMethod?fbq.callMethod.apply(fbq,arguments):fbq.queue.push(arguments);};fbq.queue=[];fbq.loaded=true;fbq.version='2.0';window.fbq=fbq;window._fbq=fbq;
  window.fbq('init',config.metaPixelId);
  const s=document.createElement('script');s.id='circulo-meta';s.async=true;s.src='https://connect.facebook.net/en_US/fbevents.js';document.head.append(s);
 }
}
export function initMarketing() {
 if(!initializing) initializing=(async()=>{
  try{config=await fetch('/api/marketing/config').then(r=>r.ok?r.json():{});}catch{}
  installTags();ready=true;listeners.forEach(fn=>fn());
 })();
 return initializing;
}
export const onMarketingReady=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
export const getConsent=consent;
export function setConsent(value) {
 try{localStorage.setItem('circulo-consent',JSON.stringify(value));}catch{}
 // Reload removes already loaded scripts when permission is withdrawn.
 location.reload();
}
export function track(event,propertyId) {
 if(location.pathname.startsWith('/admin')) return;
 const key=`${event}:${location.pathname}:${propertyId||''}`;
 if(Date.now()-(recentEvents.get(key)||0)<500)return;recentEvents.set(key,Date.now());
 const c=consent();if(!c?.analytics&&!c?.marketing)return;
 const a=attribution(), id=uuid();
 let sessionId=read('circulo-session');if(!sessionId){sessionId=uuid();save('circulo-session',sessionId);}
 if(c.analytics) fetch('/api/marketing/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,sessionId,event,path:cleanPath(),propertyId,attribution:a,consent:true}),keepalive:true}).catch(()=>{});
 const t=a.latest?.source?a.latest:a.first;
 const payload={...(t?{campaign_source:t.source,campaign_medium:t.medium,campaign_name:t.campaign,campaign_content:t.content}:{}),page_location:`${location.origin}${cleanPath()}`,page_title:cleanPath(),...(propertyId?{property_id:propertyId}:{}),...(a.experiment?{experiment_id:a.experiment,variant:a.variant}:{})};
 if(c.analytics&&window.gtag)window.gtag('event',event,payload);
 if(c.marketing&&window.fbq){const names={page_view:'PageView',view_property:'ViewContent',generate_lead:'Lead'};if(names[event])window.fbq('track',names[event],propertyId?{content_ids:[propertyId],content_type:'product'}:{},{eventID:id});}
}
export function trackLead(propertyId,inquiryId) {
 // The server records the confirmed inquiry; do not count a second client lead internally.
 const c=consent();
 if(c?.analytics&&window.gtag)window.gtag('event','generate_lead',{property_id:propertyId});
 if(c?.marketing&&window.fbq)window.fbq('track','Lead',{content_ids:[propertyId]},{eventID:inquiryId});
}
export function contactLabel() {return attribution().variant==='B'?'Agenda tu visita por WhatsApp':'Consultar por WhatsApp';}
export function campaignReference() {const a=attribution(),t=a.latest?.source?a.latest:a.first;return [t?.source,t?.campaign,t?.content,a.experiment,a.variant].filter(Boolean).join(' / ');}
