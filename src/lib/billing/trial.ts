import {createAdminClient} from "@/lib/supabase/admin";
export async function applyConfiguredTrialToNewUser(userId:string,userCreatedAt?:string){
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!serviceKey)return;
 const parsed=Number.parseInt(process.env.TRIAL_DAYS||"7",10);
 const days=Number.isFinite(parsed)?Math.max(0,Math.min(90,parsed)):7;
 const admin=createAdminClient();
 const {data:subscription,error}=await admin.from("subscriptions").select("created_at,status").eq("user_id",userId).maybeSingle();
 if(error||!subscription||subscription.status!=="trialing")return;
 const reference=userCreatedAt?new Date(userCreatedAt).getTime():Date.now();
 const created=new Date(subscription.created_at).getTime();
 // Only adjust the just-created trial. Never extend a returning user's trial on sign-in.
 if(!Number.isFinite(reference)||Math.abs(created-reference)>5*60*1000)return;
 const trialEnd=new Date(reference+days*86400000).toISOString();
 await admin.from("subscriptions").update({trial_ends_at:trialEnd,current_period_end:trialEnd}).eq("user_id",userId).eq("status","trialing");
}
