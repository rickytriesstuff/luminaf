import type {SupabaseClient} from "@supabase/supabase-js";
export async function hasActiveEntitlement(supabase:SupabaseClient,userId:string){
 const {data,error}=await supabase.from("subscriptions").select("status,trial_ends_at,current_period_end").eq("user_id",userId).maybeSingle();
 if(error||!data)return false;
 const now=Date.now();
 const trialing=data.status==="trialing"&&!!data.trial_ends_at&&new Date(data.trial_ends_at).getTime()>now;
 const paid=["active","past_due"].includes(data.status)&&!!data.current_period_end&&new Date(data.current_period_end).getTime()>now;
 return trialing||paid;
}
export function entitlementRequiredResponse(){
 return {error:"Your free trial or subscription is no longer active. Subscribe to continue logging. Your saved data remains available.",code:"SUBSCRIPTION_REQUIRED"};
}
