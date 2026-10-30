"use client";
import {useState} from "react";
import {BellRing,ShieldCheck} from "lucide-react";

function encodeKey(value:string){
 const padding="=".repeat((4-value.length%4)%4);
 const base=value.replace(/-/g,"+").replace(/_/g,"/")+padding;
 const binary=atob(base);
 return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
export default function PushSetup(){
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 async function enable(){
  setBusy(true);setMessage("");
  try{
   if(!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error("This browser does not support web push.");
   if(!window.isSecureContext)throw new Error("Push notifications require HTTPS.");
   const permission=await Notification.requestPermission();
   if(permission!=="granted")throw new Error("Notification permission was not granted. You can enable it in browser settings.");
   const keyResponse=await fetch("/api/push/key",{cache:"no-store"});
   const keyData=await keyResponse.json();
   if(!keyResponse.ok)throw new Error(keyData.error||"Push is not configured yet.");
   const registration=await navigator.serviceWorker.ready;
   const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:encodeKey(keyData.publicKey)});
   const response=await fetch("/api/push/subscriptions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(subscription.toJSON())});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Could not register this device.");
   setMessage("This device is registered for Luminaf push notifications.");
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to enable notifications.");}
  finally{setBusy(false);}
 }
 async function disable(){
  setBusy(true);setMessage("");
  try{
   const registration=await navigator.serviceWorker.ready;
   const subscription=await registration.pushManager.getSubscription();
   if(!subscription){setMessage("This device has no active push subscription.");return;}
   const endpoint=subscription.endpoint;
   const response=await fetch("/api/push/subscriptions",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Unable to remove this device.");
   await subscription.unsubscribe();
   setMessage("Push notifications disabled for this device.");
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to disable notifications.");}
  finally{setBusy(false);}
 }
 return <section className="panel mt-5 rounded-3xl p-5">
  <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#10251B] text-[#8CFFC9]"><BellRing size={19}/></span><div><h2 className="font-semibold">Device notifications</h2><p className="text-xs text-[#91A49A]">Register this browser to receive scheduled reminders.</p></div></div>
  <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={enable} className="rounded-xl bg-[#00E58A] px-4 py-2.5 text-xs font-bold text-[#03120B] disabled:opacity-50">Enable on this device</button><button disabled={busy} onClick={disable} className="rounded-xl border border-[#31513F] px-4 py-2.5 text-xs text-[#B7F9D5] disabled:opacity-50">Disable on this device</button></div>
  {message&&<p role="status" className="mt-3 rounded-xl border border-[#31513F] bg-[#0C1711] p-3 text-xs leading-relaxed text-[#B7F9D5]">{message}</p>}
  <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-[#71847A]"><ShieldCheck size={14} className="shrink-0"/> Permission is controlled by your browser. Scheduled delivery only starts after VAPID keys and the Supabase push worker are configured.</p>
 </section>;
}
