"use client";
import {useEffect,useState} from "react";
import {Clock,ArrowUpRight} from "lucide-react";
type Status={status:string;active:boolean;trial_days_remaining?:number;trial_ends_at?:string};
export default function TrialBanner(){
 const [state,setState]=useState<Status|null>(null);
 useEffect(()=>{fetch("/api/billing/status",{cache:"no-store"}).then(async r=>({ok:r.ok,data:await r.json()})).then(({ok,data})=>{if(ok)setState(data);}).catch(()=>{});},[]);
 if(!state||state.status==="not_initialized"||state.status!=="trialing")return null;
 const active=state.active;
 return <section className={active?"mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#31513F] bg-[#0C1711] p-4":"mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#6B3A32] bg-[#1A100E] p-4"}>
  <div className="flex min-w-0 items-center gap-3"><span className={active?"text-[#8CFFC9]":"text-[#F0A99A]"}><Clock size={19}/></span><div><p className="text-sm font-semibold">{active?"Your free trial is active":"Your free trial has ended"}</p><p className="mt-1 text-xs text-[#91A49A]">{active?String(state.trial_days_remaining??0)+" days remaining. Enjoy your wellness tools.":"Subscribe to continue logging. Your saved data remains available."}</p></div></div>
  <a href="/subscribe" className="shrink-0 text-xs font-semibold text-[#8CFFC9]">{active?"Details":"View plans"} <ArrowUpRight size={13} className="inline"/></a>
 </section>;
}
