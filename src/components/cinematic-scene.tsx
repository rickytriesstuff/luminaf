"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
type Scene = "home" | "food" | "fitness" | "progress";
type Props = { scene: Scene; eyebrow: string; title: string; description: string; metric?: string | number; metricLabel?: string; detail?: string };
const scenes: Record<Scene,{image:string;alt:string;accent:string;floaters:string[]}> = {
 home:{image:"https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=1800&q=85",alt:"Sunlit mountain lake at dawn",accent:"DAILY RHYTHM",floaters:["✦","☀","✧"]},
 food:{image:"https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1800&q=85",alt:"Fresh colorful nourishing food",accent:"FUEL YOUR DAY",floaters:["🍓","🥑","🍊"]},
 fitness:{image:"https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1800&q=85",alt:"Atmospheric modern training studio",accent:"FIND YOUR PACE",floaters:["✦","↗","✧"]},
 progress:{image:"https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1800&q=85",alt:"Golden sunlight over a mountain landscape",accent:"THE BIGGER PICTURE",floaters:["✦","↑","✧"]}
};
function useCount(value:string|number|undefined){
 const target=typeof value==="number"?value:Number(value),[shown,setShown]=useState(0),reduce=useReducedMotion();
 useEffect(()=>{if(!Number.isFinite(target))return;if(reduce){setShown(target);return;}let frame=0;const start=performance.now(),duration=1100;const tick=(now:number)=>{const p=Math.min(1,(now-start)/duration);setShown(Math.round(target*(1-Math.pow(1-p,4))));if(p<1)frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[target,reduce]);
 return Number.isFinite(target)?shown.toLocaleString():value??"—";
}
export function CinematicScene({scene,eyebrow,title,description,metric,metricLabel,detail}:Props){
 const visual=scenes[scene],animatedMetric=useCount(metric);
 return <section className={`cinema-scene cinema-${scene}`} aria-label={title}>
  <div className="cinema-image" style={{backgroundImage:`url("${visual.image}")`}} role="img" aria-label={visual.alt}/>
  <div className="cinema-grain"/><div className="cinema-orbit cinema-orbit-one"/><div className="cinema-orbit cinema-orbit-two"/>
  {visual.floaters.map((item,i)=><motion.span key={i} className={`cinema-floater cinema-floater-${i}`} aria-hidden="true" animate={{y:[0,-13,0],rotate:[0,i%2?8:-8,0],opacity:[.55,1,.55]}} transition={{duration:5+i,repeat:Infinity,ease:"easeInOut",delay:i*.35}}>{item}</motion.span>)}
  <div className="cinema-content"><div className="cinema-copy"><p className="cinema-eyebrow"><span/>{eyebrow||visual.accent}</p><h1>{title}</h1><p className="cinema-description">{description}</p><div className="cinema-live"><span className="cinema-live-dot"/> YOUR JOURNEY, IN MOTION</div></div>
  {metric!==undefined&&<motion.div className="cinema-stat" initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.7,delay:.2}}><span className="cinema-stat-label">{metricLabel||"TODAY'S MOMENTUM"}</span><strong>{animatedMetric}</strong>{detail&&<span className="cinema-stat-detail">{detail}</span>}</motion.div>}</div>
  <div className="cinema-bottom"><span>{visual.accent}</span><span>MOVE · NOURISH · REST · REPEAT</span></div>
 </section>;
}