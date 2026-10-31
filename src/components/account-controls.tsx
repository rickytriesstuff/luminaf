"use client";
import {useState} from "react";
import {Download,Trash2,ShieldAlert} from "lucide-react";
export default function AccountControls(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function removeAccount(){
  if(!window.confirm("Permanently delete your Luminaf account, wellness records and private meal photos? This cannot be undone. Export your data first if you want a copy."))return;
  if(!window.confirm("Final confirmation: permanently delete this account and its data?"))return;
  setBusy(true);setMessage("");
  try{
   const response=await fetch("/api/account/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmation:"DELETE"})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Account deletion failed.");
   window.location.assign((process.env.NEXT_PUBLIC_SITE_BASE_PATH||"")+"/auth/?message=Your%20account%20was%20deleted");
  }catch(error){setMessage(error instanceof Error?error.message:"Unable to delete account.");}
  finally{setBusy(false);}
 }
 return <section className="panel mt-5 rounded-3xl p-5">
  <div className="flex items-center gap-3"><Download className="text-[#8CFFC9]"/><div><h2 className="font-semibold">Your data</h2><p className="text-xs text-[#91A49A]">Download a copy of your account and wellness records.</p></div></div>
  <button disabled={busy} onClick={async()=>{setBusy(true);setMessage("");try{const response=await fetch("/api/account/export");if(!response.ok){const data=await response.json();throw new Error(data.error||"Export failed.");}const blob=await response.blob(),href=URL.createObjectURL(blob),link=document.createElement("a");link.href=href;link.download="luminaf-export.json";link.click();URL.revokeObjectURL(href);}catch(error){setMessage(error instanceof Error?error.message:"Unable to export data.");}finally{setBusy(false);}}} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#31513F] p-3 text-sm text-[#B7F9D5] disabled:opacity-50"><Download size={16}/> Export my data (JSON)</button>
  <div className="my-5 h-px bg-[#26372E]"/>
  <div className="flex items-center gap-3"><ShieldAlert className="text-red-300"/><div><h2 className="font-semibold">Delete account</h2><p className="text-xs text-[#91A49A]">Permanently remove your account, saved records and private meal photos.</p></div></div>
  <button disabled={busy} onClick={removeAccount} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/70 bg-red-950/20 p-3 text-sm text-red-200 disabled:opacity-50"><Trash2 size={16}/>{busy?"Deleting securely…":"Permanently delete my account"}</button>
  {message&&<p role="status" className="mt-3 text-xs text-red-200">{message}</p>}
  <p className="mt-3 text-[11px] leading-relaxed text-[#71847A]">Deletion is permanent. Download your data first if you want to keep a copy.</p>
 </section>;
}
