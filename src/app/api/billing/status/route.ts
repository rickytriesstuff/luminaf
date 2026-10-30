import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("subscriptions").select("status,trial_ends_at,current_period_end,provider").eq("user_id",user.id).maybeSingle();
 if(error)return NextResponse.json({error:"Unable to read subscription status."},{status:500});
 if(!data)return NextResponse.json({status:"not_initialized",active:false,checkout_configured:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID)});
 const now=Date.now(),trialEnd=data.trial_ends_at?new Date(data.trial_ends_at).getTime():0,periodEnd=data.current_period_end?new Date(data.current_period_end).getTime():0;
 const trialActive=data.status==="trialing"&&trialEnd>now;
 const paidActive=["active","past_due"].includes(data.status)&&periodEnd>now;
 return NextResponse.json({status:data.status,trial_ends_at:data.trial_ends_at,current_period_end:data.current_period_end,active:trialActive||paidActive,trial_days_remaining:trialActive?Math.ceil((trialEnd-now)/86400000):0,checkout_configured:Boolean(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID)});
}
