"use client";
import {useEffect,useState} from "react";
import {usePathname,useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
export function AuthGuard({children}:{children:React.ReactNode}){
 const pathname=usePathname(),router=useRouter(),[ready,setReady]=useState(false);
 const isPublic=pathname?.startsWith("/auth")||pathname?.startsWith("/privacy")||pathname?.startsWith("/terms");
 useEffect(()=>{let live=true;if(isPublic){setReady(true);return;}let settled=false;const client=createClient();client.auth.getSession().then(({data,error})=>{if(!live)return;settled=true;if(error||!data.session){router.replace("/auth/");}else setReady(true);});const {data:{subscription}}=client.auth.onAuthStateChange((_event,session)=>{if(!live)return;if(session){setReady(true);}else if(!isPublic){setReady(false);router.replace("/auth/");}});return()=>{live=false;subscription.unsubscribe();};},[pathname,isPublic,router]);
 if(isPublic||ready)return <>{children}</>;
 return <main className="grid min-h-screen place-items-center px-6 text-center"><div><div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-[#00E58A]/20 ring-1 ring-[#8CFFC9]/50"/><p className="mt-4 text-sm text-[#B7F9D5]">Opening your private Luminaf space…</p></div></main>;
}
