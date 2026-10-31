import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const vapidPublicKey=Deno.env.get("VAPID_PUBLIC_KEY")||"";
const vapidPrivateKey=Deno.env.get("VAPID_PRIVATE_KEY")||"";
const vapidSubject=Deno.env.get("VAPID_SUBJECT")||"";\nconst siteBasePath=(Deno.env.get("SITE_BASE_PATH")||"/luminaf").replace(/\\/$/,"");
const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
const copy:Record<string,{title:string;body:string}>={water:{title:"A little hydration break",body:"Take a moment to drink some water."},meals:{title:"Meal check-in",body:"If you have eaten, remember to log your meal."},movement:{title:"Time to move",body:"A short walk or stretch can be a lovely reset."},weight:{title:"Progress check-in",body:"If it feels useful today, log a body measurement."},winddown:{title:"Ease into the evening",body:"Give yourself a little room to wind down."}};
function localMinute(timezone:string,now:Date){try{return new Intl.DateTimeFormat("en-GB",{timeZone:timezone,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(now);}catch{return null;}}
function quietNow(value:unknown,minute:string){if(!value||typeof value!=="object")return false;const q=value as {enabled?:boolean;start?:string;end?:string};if(!q.enabled||!q.start||!q.end||q.start===q.end)return false;return q.start<q.end?minute>=q.start&&minute<q.end:minute>=q.start||minute<q.end;}
Deno.serve(async request=>{
 if(request.method!=="POST")return new Response("Method not allowed",{status:405});
 if(!serviceRoleKey||request.headers.get("authorization")!=="Bearer "+serviceRoleKey)return new Response("Unauthorized",{status:401});
 if(!vapidPublicKey||!vapidPrivateKey||!vapidSubject)return Response.json({error:"VAPID keys or subject are not configured."},{status:503});
 webpush.setVapidDetails(vapidSubject,vapidPublicKey,vapidPrivateKey);
 const now=new Date(),scheduledFor=new Date(Math.floor(now.getTime()/60000)*60000).toISOString();
 const {data:reminders,error}=await admin.from("reminders").select("id,user_id,kind,local_time,timezone,enabled,quiet_hours").eq("enabled",true);
 if(error)return Response.json({error:"Unable to load reminders."},{status:500});
 let queued=0;
 const trialNow=now.toISOString();
 const trialHorizon=new Date(now.getTime()+24*60*60*1000).toISOString();
 const {data:trials,error:trialError}=await admin.from("subscriptions").select("id,user_id,trial_ends_at").eq("status","trialing").gt("trial_ends_at",trialNow).lte("trial_ends_at",trialHorizon).is("trial_reminder_sent_at",null).limit(100);
 if(trialError)return Response.json({error:"Unable to load trial reminders."},{status:500});
 for(const trial of trials||[]){
  const {data:claimed,error:claimError}=await admin.from("subscriptions").update({trial_reminder_sent_at:now.toISOString()}).eq("id",trial.id).is("trial_reminder_sent_at",null).select("id").maybeSingle();
  if(claimError||!claimed)continue;
  const {error:noticeError}=await admin.from("notifications").insert({user_id:trial.user_id,title:"Your Luminaf trial ends within 24 hours",body:"Your free trial is nearly over. Review Luminaf Plus to keep full access to your wellness tools.",delivery_status:"queued"});
  if(noticeError){
   await admin.from("subscriptions").update({trial_reminder_sent_at:null}).eq("id",trial.id);
   console.error("Trial reminder enqueue failed",noticeError.message);
  }else queued++;
 }
 for(const reminder of reminders||[]){const minute=localMinute(reminder.timezone||"UTC",now);if(!minute||minute!==String(reminder.local_time||"").slice(0,5)||quietNow(reminder.quiet_hours,minute))continue;const message=copy[reminder.kind]||{title:"Luminaf reminder",body:"A gentle nudge for your wellness routine."};const result=await admin.from("notifications").insert({user_id:reminder.user_id,reminder_id:reminder.id,scheduled_for:scheduledFor,title:message.title,body:message.body,delivery_status:"queued"});if(!result.error)queued++;else if(result.error.code!=="23505")console.error("Notification queue insert failed",result.error.message);}
 const cutoff=new Date(now.getTime()-15*60000).toISOString();
 const {data:pending,error:pendingError}=await admin.from("notifications").select("id,user_id,title,body,attempts").eq("delivery_status","queued").gte("created_at",cutoff).lt("attempts",3).order("created_at",{ascending:true}).limit(100);
 if(pendingError)return Response.json({error:"Unable to load notification queue."},{status:500});
 let delivered=0;
 for(const item of pending||[]){const {data:subs,error:subError}=await admin.from("push_subscriptions").select("id,subscription").eq("user_id",item.user_id);if(subError)continue;if(!subs?.length){await admin.from("notifications").update({delivery_status:"no_subscription",attempts:3}).eq("id",item.id);continue;}let success=false,lastError="";for(const sub of subs){try{await webpush.sendNotification(sub.subscription,JSON.stringify({title:item.title,body:item.body,url:siteBasePath+"/",notificationId:item.id}),{TTL:3600});success=true;}catch(err){const code=Number((err as {statusCode?:number}).statusCode||0);lastError=code?"Push provider returned "+code:"Push delivery failed";if(code===404||code===410)await admin.from("push_subscriptions").delete().eq("id",sub.id);}}const attempts=Number(item.attempts||0)+1;await admin.from("notifications").update({delivery_status:success?"delivered":attempts>=3?"failed":"queued",delivered_at:success?new Date().toISOString():null,attempts,last_error:success?null:lastError.slice(0,240)}).eq("id",item.id);if(success)delivered++;}
 return Response.json({queued,delivered,checked:pending?.length||0});
});