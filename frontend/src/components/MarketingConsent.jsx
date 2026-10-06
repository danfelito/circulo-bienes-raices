import React,{useEffect,useState} from 'react';
import {useLocation} from 'react-router-dom';
import {getConsent,setConsent,initMarketing,onMarketingReady,track,attribution} from '../lib/marketing';
export default function MarketingConsent(){
 const {pathname}=useLocation();const [ready,setReady]=useState(false);const [open,setOpen]=useState(!getConsent());
 useEffect(()=>{const off=onMarketingReady(()=>setReady(true));initMarketing();return off;},[]);
 useEffect(()=>{if(ready&&!pathname.startsWith('/admin')){track('page_view');if(attribution().experiment)track('experiment_exposure');}},[pathname,ready]);
 if(pathname.startsWith('/admin'))return null;
 return <><button onClick={()=>setOpen(true)} className="fixed bottom-3 left-3 z-40 rounded-lg bg-black/80 px-3 py-2 text-xs text-white">Privacidad y medición</button>{open&&<section role="dialog" aria-label="Preferencias de medición" className="fixed bottom-0 inset-x-0 z-50 bg-[#151515] border-t border-white/20 p-5 text-white"><div className="max-w-5xl mx-auto"><h2 className="font-semibold">Preferencias de medición</h2><p className="text-sm text-gray-300 my-3">Con tu permiso medimos visitas y acciones para mejorar el sitio. La opción de publicidad permite enviar eventos a Meta. Puedes cambiar tu elección aquí; los formularios y WhatsApp funcionan con cualquier opción.</p><div className="flex flex-wrap gap-3"><button className="rounded-lg border px-4 py-2" onClick={()=>setConsent({analytics:false,marketing:false})}>Solo necesarias</button><button className="rounded-lg border px-4 py-2" onClick={()=>setConsent({analytics:true,marketing:false})}>Permitir medición</button><button className="rounded-lg bg-amber-500 px-4 py-2" onClick={()=>setConsent({analytics:true,marketing:true})}>Medición y publicidad</button></div></div></section>}</>;
}
