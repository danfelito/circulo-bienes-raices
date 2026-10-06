const response = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json','cache-control':'no-store'}});
const fail = (message, status=400) => {throw Object.assign(new Error(message),{status});};
const text = (value, max=120) => String(value || '').replace(/[\r\n<>]/g,'').slice(0,max);
const label = value => /^[\w .:/-]{1,120}$/.test(String(value || '')) ? String(value) : '';
const stages = ['nuevo','contactado','calificado','visita_agendada','visita_realizada','negociacion','cerrado','perdido'];
const events = new Set(['page_view','view_property','whatsapp_click','phone_click','email_click','experiment_exposure']);
export const safeAttribution = data => {
 const cleanTouch = touch => Object.fromEntries(['source','medium','campaign','content','term'].map(k=>[k,label(touch?.[k])]).filter(([,v])=>v));
 return {first:cleanTouch(data?.first),latest:cleanTouch(data?.latest),experiment:label(data?.experiment),variant:['A','B'].includes(data?.variant)?data.variant:'',path:safePath(data?.path)};
};
const safePath = value => {
 try {const path = new URL(String(value || '/'),'https://local.invalid').pathname; return /^\/(?:propiedades(?:\/[a-z0-9-]+)?|asesores)?\/?$/.test(path)?path:'/';} catch{return '/';}
};
export async function marketingConfig(env) {
 const row = await env.DB.prepare('SELECT config FROM marketing_settings WHERE id=1').first();
 const data = row ? JSON.parse(row.config) : {};
 return {ga4Id:data.ga4Id || '',metaPixelId:data.metaPixelId || '',experiment:data.experiment || null};
}
export async function processCrm(env) {
 if (!env.GHL_CIRCULO_PRIVATE_TOKEN || !env.GHL_CIRCULO_LOCATION_ID) return;
 const {results} = await env.DB.prepare(`SELECT i.*, m.attribution FROM crm_outbox o JOIN inquiries i ON i.id=o.inquiryId LEFT JOIN inquiry_marketing m ON m.inquiryId=i.id WHERE o.status='pending' AND o.attempts<5 ORDER BY o.updatedAt LIMIT 5`).all();
 for (const row of results || []) {
  // Claim before network IO; no automatic retry of an ambiguous request.
  const claim=await env.DB.prepare("UPDATE crm_outbox SET status='sending',attempts=attempts+1,updatedAt=? WHERE inquiryId=? AND status='pending'").bind(new Date().toISOString(),row.id).run();
  if (!claim.meta?.changes) continue;
  try {
   const a=JSON.parse(row.attribution || '{}');
   const res=await fetch('https://services.leadconnectorhq.com/contacts/upsert',{method:'POST',headers:{Authorization:`Bearer ${env.GHL_CIRCULO_PRIVATE_TOKEN}`,Version:'2021-07-28','Content-Type':'application/json'},body:JSON.stringify({locationId:env.GHL_CIRCULO_LOCATION_ID,name:row.name,email:row.email,...(row.phone?{phone:row.phone}:{}),source:`Web Círculo / ${a.latest?.source || a.first?.source || 'desconocido'}`}),signal:AbortSignal.timeout(10000)});
   if(!res.ok) throw new Error(`HTTP ${res.status}`);
   const payload=await res.json();
   if(!payload.contact?.id) throw new Error('Respuesta sin contactId');
   await env.DB.prepare("UPDATE crm_outbox SET status='sent',contactId=?,lastError=NULL,updatedAt=? WHERE inquiryId=?").bind(payload.contact.id,new Date().toISOString(),row.id).run();
  } catch(error) {
   await env.DB.prepare("UPDATE crm_outbox SET status='failed',lastError=?,updatedAt=? WHERE inquiryId=?").bind(text(error.message,100),new Date().toISOString(),row.id).run();
  }
 }
}
export async function marketingApi(request,env,{requireAdmin,readJson}) {
 const url=new URL(request.url), path=url.pathname, method=request.method;
 if(path==='/api/marketing/config' && method==='GET') return response(await marketingConfig(env));
 if(path==='/api/marketing/events' && method==='POST') {
  if(request.headers.get('origin')!==url.origin) fail('Origen no permitido',403);
  const body=await readJson(request);
  if(body.consent!==true || !events.has(body.event) || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.sessionId || '') || !/^[a-zA-Z0-9_-]{16,80}$/.test(body.id || '')) fail('Evento no válido');
  const recent=await env.DB.prepare("SELECT COUNT(*) AS count FROM marketing_events WHERE sessionId=? AND createdAt>?").bind(body.sessionId,new Date(Date.now()-60000).toISOString()).first();
  if(recent.count>=60) fail('Demasiados eventos',429);
  const a=safeAttribution(body.attribution), t=a.latest?.source?a.latest:a.first;
  await env.DB.prepare('INSERT OR IGNORE INTO marketing_events (id,sessionId,event,path,propertyId,source,medium,campaign,content,experiment,variant,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(body.id,body.sessionId,body.event,safePath(body.path),text(body.propertyId,80)||null,t.source || 'desconocido',t.medium||'',t.campaign||'',t.content||'',a.experiment,a.variant,new Date().toISOString()).run();
  return response({accepted:true});
 }
 if(!path.startsWith('/api/admin/marketing')) return null;
 await requireAdmin(request,env);
 if(path==='/api/admin/marketing/config' && method==='PUT') {
  const body=await readJson(request);
  if(body.ga4Id && !/^G-[A-Z0-9]{4,20}$/.test(body.ga4Id)) fail('ID de GA4 inválido');
  if(body.metaPixelId && !/^\d{5,30}$/.test(body.metaPixelId)) fail('ID de Meta inválido');
  let experiment=null;
  if(body.experiment?.active) {
   const e=body.experiment;
   if(!/^[a-z0-9_-]{3,60}$/.test(e.id || '') || !/^\/propiedades\/[a-z0-9-]+$/.test(e.path || '') || !e.hypothesis || !e.reviewDate) fail('Completa ID, propiedad, hipótesis y fecha de evaluación');
   experiment={active:true,id:e.id,path:e.path,hypothesis:text(e.hypothesis,500),reviewDate:text(e.reviewDate,10),budgetLimit:Math.max(0,Number(e.budgetLimit)||0)};
  }
  const config={ga4Id:body.ga4Id||'',metaPixelId:body.metaPixelId||'',experiment};
  await env.DB.prepare('INSERT INTO marketing_settings (id,config,updatedAt) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET config=excluded.config,updatedAt=excluded.updatedAt').bind(JSON.stringify(config),new Date().toISOString()).run();
  return response(config);
 }
 if(path==='/api/admin/marketing/stage' && method==='PUT') {
  const body=await readJson(request); if(!stages.includes(body.stage)) fail('Etapa inválida');
  await env.DB.prepare('UPDATE inquiry_marketing SET stage=?,updatedAt=? WHERE inquiryId=?').bind(body.stage,new Date().toISOString(),text(body.inquiryId,80)).run(); return response({ok:true});
 }
 if(path==='/api/admin/marketing/retry' && method==='POST') {
  const body=await readJson(request);
  await env.DB.prepare("UPDATE crm_outbox SET status='pending' WHERE inquiryId=? AND status='failed' AND attempts<5").bind(text(body.inquiryId,80)).run();
  await processCrm(env); return response({ok:true});
 }
 if(path==='/api/admin/marketing' && method==='GET') {
  const days=Math.min(90,Math.max(1,parseInt(url.searchParams.get('days'))||30));
  const since=new Date(Date.now()-days*86400000).toISOString();
  const queries=[
   ['totals',"SELECT event,COUNT(*) AS total,COUNT(DISTINCT sessionId) AS sessions FROM marketing_events WHERE createdAt>=? GROUP BY event"],
   ['sources',"SELECT source,campaign,event,COUNT(*) AS total FROM marketing_events WHERE createdAt>=? GROUP BY source,campaign,event ORDER BY total DESC LIMIT 100"],
   ['properties',"SELECT e.propertyId,p.title,e.event,COUNT(*) AS total FROM marketing_events e LEFT JOIN properties p ON p.id=e.propertyId WHERE e.createdAt>=? AND e.propertyId IS NOT NULL GROUP BY e.propertyId,e.event ORDER BY total DESC LIMIT 100"],
   ['experiments',"SELECT experiment,variant,event,COUNT(DISTINCT sessionId) AS sessions FROM marketing_events WHERE createdAt>=? AND experiment!='' GROUP BY experiment,variant,event"],
   ['leads',"SELECT i.id,i.name,i.propertyId,i.createdAt,m.attribution,m.stage,o.status AS crmStatus,o.lastError FROM inquiries i JOIN inquiry_marketing m ON m.inquiryId=i.id LEFT JOIN crm_outbox o ON o.inquiryId=i.id WHERE i.createdAt>=? ORDER BY i.createdAt DESC LIMIT 100"]
  ];
  const results=await env.DB.batch(queries.map(([,sql])=>env.DB.prepare(sql).bind(since)));
  return response({since,days,config:await marketingConfig(env),connections:{crmConfigured:Boolean(env.GHL_CIRCULO_PRIVATE_TOKEN&&env.GHL_CIRCULO_LOCATION_ID),metaCapi:false},...Object.fromEntries(queries.map(([key],i)=>[key,results[i].results||[]]))});
 }
 return response({error:'Ruta no encontrada'},404);
}
