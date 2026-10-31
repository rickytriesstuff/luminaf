"use client";
import {AnimatePresence,motion} from "framer-motion";
import {useEffect,useState} from "react";
import {usePathname} from "next/navigation";
import {ArrowUpRight,LogIn} from "lucide-react";
import {createClient} from "@/lib/supabase/client";
const scenes=[
 {name:"MOVE WITH FREEDOM",caption:"A run, a fresh start.",image:"https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=2200&q=85"},
 {name:"BUILD YOUR STRENGTH",caption:"Show up. Find your power.",image:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2200&q=85"},
 {name:"PAUSE & HYDRATE",caption:"Make room for a little reset.",image:"https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=2200&q=85"},
 {name:"NOURISH YOURSELF",caption:"Good food, good energy.",image:"https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=2200&q=85"},
 {name:"REST IS PROGRESS",caption:"Let your body recharge.",image:"https://images.unsplash.com/photo-1511295742362-4c2e8f7b6b8a?auto=format&fit=crop&w=2200&q=85"},
 {name:"MAKE SPACE TO GROW",caption:"A quiet moment with a good book.",image:"https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=2200&q=85"},
 {name:"BREATHE & RESET",caption:"Stretch, soften, begin again.",image:"https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=2200&q=85"}
];
export function AppAtmosphere(){
 const pathname=usePathname(),[active,setActive]=useState(0),[signedIn,setSignedIn]=useState(false);
 useEffect(()=>{const timer=window.setInterval(()=>setActive(v=>(v+1)%scenes.length),6500);return()=>window.clearInterval(timer);},[]);
 useEffect(()=>{let alive=true;try{const client=createClient();client.auth.getSession().then(({data})=>{if(alive)setSignedIn(!!data.session);});const {data}=client.auth.onAuthStateChange((_event,session)=>{if(alive)setSignedIn(!!session);});return()=>{alive=false;data.subscription.unsubscribe();};}catch{return()=>{alive=false;};}},[]);
 const scene=scenes[active],isAuth=pathname?.startsWith("/auth");
 return <>
  <div className="app-atmosphere" aria-hidden="true">
   <AnimatePresence mode="sync">
    <motion.div key={scene.image} className="app-atmosphere-image" style={{backgroundImage:`url("${scene.image}")`}} initial={{opacity:0,scale:1.08}} animate={{opacity:1,scale:1.015}} exit={{opacity:0}} transition={{duration:1.8,ease:"easeInOut"}}/>
   </AnimatePresence>
   <div className="app-atmosphere-shade"/>
   <div className="app-atmosphere-caption"><span className="app-atmosphere-kicker">{scene.name}</span><span>{scene.caption}</span><span className="app-atmosphere-progress"><i style={{width:((active+1)/scenes.length*100)+"%"}}/></span></div>
  </div>
  {!isAuth&&<a href="/auth/" className="app-auth-entry"><span className="app-auth-icon">{signedIn?<ArrowUpRight size={15}/>:<LogIn size={15}/>}</span><span>{signedIn?"My account":"Sign in / Get started"}</span></a>}
 </>;
}
