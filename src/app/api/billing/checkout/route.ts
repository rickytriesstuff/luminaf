import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
export async function POST(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to subscribe."},{status:401});
 const secret=process.env.STRIPE_SECRET_KEY,price=process.env.STRIPE_PRICE_ID;
 if(!secret||!price)return NextResponse.json({error:"Secure checkout is not configured yet."},{status:503});
 const {data:subscription,error}=await supabase.from("subscriptions").select("status,trial_ends_at,provider_customer_id").eq("user_id",user.id).maybeSingle();
 if(error||!subscription)return NextResponse.json({error:"Subscription record is unavailable."},{status:503});
 if(subscription.status==="trialing"&&subscription.trial_ends_at&&new Date(subscription.trial_ends_at).getTime()>Date.now())return NextResponse.json({error:"Your free trial is still active. You can subscribe when it ends."},{status:409});
 if(["active","past_due"].includes(subscription.status))return NextResponse.json({error:"You already have a subscription. Use the billing portal to manage it."},{status:409});
 const origin=process.env.NEXT_PUBLIC_APP_URL;
 if(!origin)return NextResponse.json({error:"Application URL is not configured."},{status:503});
 const form=new URLSearchParams();
 form.set("mode","subscription");
 form.set("line_items[0][price]",price);
 form.set("line_items[0][quantity]","1");
 form.set("success_url",new URL("/subscribe?checkout=success",origin).toString());
 form.set("cancel_url",new URL("/subscribe?checkout=cancelled",origin).toString());
 form.set("client_reference_id",user.id);
 form.set("metadata[user_id]",user.id);
 form.set("subscription_data[metadata][user_id]",user.id);
 if(subscription.provider_customer_id)form.set("customer",subscription.provider_customer_id);
 else if(user.email)form.set("customer_email",user.email);
 const response=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),cache:"no-store"});
 const payload=await response.json();
 if(!response.ok||typeof payload.url!=="string"){console.error("Stripe checkout error",response.status,payload.error?.type);return NextResponse.json({error:"Unable to start secure checkout. Please try again."},{status:502});}
 return NextResponse.json({url:payload.url});
}
