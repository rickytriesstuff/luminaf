import {createClient} from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Reminder={id:string;user_id:string;kind:string;local_time:string|null;timezone:string;enabled:boolean;quiet_hours:unknown};
type Delivery={id:string;user_id:string;title:string;body:string;attempts:number};
const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
const publicKey=Deno.env.get("VAPID_PUBLIC_KEY")!,privateKey=Deno.env.get("VAPID_PRIVATE_KEY")!,subject=Deno.env.get("VAPID_SUBJECT")!;
webpush.setVapidDetails(subject,publicKey,privateKey);
function localTime(timezone:string){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date());const hour=parts.find(p=>p.type==="hour")?.value||"00",minute=parts.find(p=>p.type==="minute")?.value||"00";return hour+":"+minute;}
function insideQuietHours(value:unknown,time:string){if(!value||typeof value!=="object")return false;const q=value as {enabled?:boolean;start?:string;end?:string};if(!q.enabled||!q.start||!q.end)return false;const now=time.split(":").reduce((a,b)=>a*60+Number(b),0),start=q.start.split(":").reduce((a,b)=>a*60+Number(b),0),end=q.end.split(":").reduce((a,b)=>a*60+Number(b),0);return start<=end?now>=start&&now<end:now>=start||now<end;}
function message(kind:string){switch(kind){case"water":return {title:"A little hydration",body:"Take a moment to drink some water."};case"meals":return {title:"Meal check-in",body:"When you're ready, log your latest meal in Luminaf."};case"movement":return {title:"Time to move",body:"A short walk or stretch can be a good reset."};case"weight":return {title:"Progress check-in",body:"If it feels useful today, log a body measurement."};case"winddown":return {title:"Wind-down time",body:"Start easing into your evening routine."};default:return {title:"Your Luminaf reminder",body:"A gentle reminder from your wellness plan."};}}
Deno.serve(async request=>{
 const expected=Deno.env.get("CRON_SECRET");
 if(!expected||request.headers.get("x-cron-secret")!==expected)return new Response("Unauthorized",{status:401});
 const now=new Date(),minute=new Date(Math.floor(now.getTime()/60000)*60000).toISOString();
 const {data:reminders,error:reminderError}=await supabase.from("reminders").select("id,user_id,kind,local_time,timezone,enabled,quiet_hours").eq("enabled",true).limit(1000);
 if(reminderError)return Response.json({error:"Unable to load reminder schedule."},{status:500});
 let enqueued=0;
 for(const reminder of (reminders??[]) as Reminder[]){
  if(!reminder.local_time)continue;
  let current:string;
  try{current=localTime(reminder.timezone||"UTC");}catch{continue;}
  if(current!==reminder.local_time.slice(0,5)||insideQuietHours(reminder.quiet_hours,current))continue;
  const content=message(reminder.kind);
  const {error}=await supabase.from("notifications").insert({user_id:reminder.user_id,reminder_id:reminder.id,scheduled_for:minute,title:content.title,body:content.body,delivery_status:"queued",attempts:0,next_attempt_at:now.toISOString()});
  if(!error)enqueued++;
  else if(error.code!=="23505")console.error("Reminder enqueue failed",reminder.id,error.message);
 }
 const {data:queue,error:queueError}=await supabase.from("notifications").select("id,user_id,title,body,attempts").in("delivery_status",["queued","failed"]).lte("next_attempt_at",now.toISOString()).lt("attempts",3).limit(100);
 if(queueError)return Response.json({error:"Unable to load notification queue."},{status:500});
 let delivered=0,failed=0;
 for(const item of (queue??[]) as Delivery[]){
  const {data:subscriptions}=await supabase.from("push_subscriptions").select("id,endpoint,subscription").eq("user_id",item.user_id);
  let successCount=0,lastError="No active push subscription is registered for this account.";
  for(const sub of subscriptions??[]){
   try{await webpush.sendNotification(sub.subscription,JSON.stringify({title:item.title,body:item.body,url:"/"}),{TTL:3600});successCount++;}
   catch(error){
    const status=typeof error==="object"&&error!==null&&"statusCode" in error?Number((error as {statusCode:unknown}).statusCode):0;
    lastError=error instanceof Error?error.message:"Push delivery failed.";
    if(status===404||status===410)await supabase.from("push_subscriptions").delete().eq("id",sub.id);
   }
  }
  if(successCount){
   await supabase.from("notifications").update({delivery_status:"delivered",delivered_at:new Date().toISOString(),attempts:item.attempts+1,last_error:null}).eq("id",item.id);
   delivered++;
  }else{
   await supabase.from("notifications").update({delivery_status:"failed",attempts:item.attempts+1,last_error:lastError,next_attempt_at:new Date(Date.now()+5*60000).toISOString()}).eq("id",item.id);
   failed++;
  }
 }
 return Response.json({enqueued,delivered,failed});
});
