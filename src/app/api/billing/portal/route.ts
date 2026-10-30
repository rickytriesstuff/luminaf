import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
export async function POST(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to manage billing."},{status:401});
 const secret=process.env.STRIPE_SECRET_KEY,origin=process.env.NEXT_PUBLIC_APP_URL;
 if(!secret||!origin)return NextResponse.json({error:"Billing portal is not configured yet."},{status:503});
 const {data,error}=await supabase.from("subscriptions").select("provider_customer_id").eq("user_id",user.id).maybeSingle();
 if(error||!data?.provider_customer_id)return NextResponse.json({error:"No Stripe customer is linked to this account yet."},{status:404});
 const form=new URLSearchParams({customer:data.provider_customer_id,return_url:new URL("/subscribe",origin).toString()});
 const response=await fetch("https://api.stripe.com/v1/billing_portal/sessions",{method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/x-www-form-urlencoded"},body:form.toString(),cache:"no-store"});
 const payload=await response.json();
 if(!response.ok||typeof payload.url!=="string"){console.error("Stripe portal error",response.status,payload.error?.type);return NextResponse.json({error:"Unable to open the billing portal."},{status:502});}
 return NextResponse.json({url:payload.url});
}
