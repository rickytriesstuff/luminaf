import {createHmac,timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
export const runtime="nodejs";
function validSignature(body:string,header:string,secret:string){
 const parts=header.split(",").map(x=>x.split("="));
 const timestamp=parts.find(([key])=>key==="t")?.[1];
 const signatures=parts.filter(([key])=>key==="v1").map(([,value])=>value);
 if(!timestamp||!signatures.length)return false;
 const seconds=Number(timestamp);
 if(!Number.isFinite(seconds)||Math.abs(Date.now()/1000-seconds)>300)return false;
 const expected=createHmac("sha256",secret).update(timestamp+"."+body).digest("hex");
 return signatures.some(signature=>{try{const a=Buffer.from(signature,"hex"),b=Buffer.from(expected,"hex");return a.length===b.length&&timingSafeEqual(a,b);}catch{return false;}});
}
function isoFromUnix(value:unknown){return typeof value==="number"&&Number.isFinite(value)?new Date(value*1000).toISOString():null;}
export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:"Webhook is not configured."},{status:503});
 const body=await request.text(),signature=request.headers.get("stripe-signature")||"";
 if(!validSignature(body,signature,secret))return NextResponse.json({error:"Invalid webhook signature."},{status:400});
 let event:any;
 try{event=JSON.parse(body);}catch{return NextResponse.json({error:"Invalid event payload."},{status:400});}
 if(typeof event.id!=="string"||typeof event.type!=="string")return NextResponse.json({error:"Invalid event envelope."},{status:400});
 const admin=createAdminClient();
 const {data:seen}=await admin.from("stripe_events").select("event_id").eq("event_id",event.id).maybeSingle();
 if(seen)return NextResponse.json({received:true,duplicate:true});
 const object=event.data?.object;
 if(event.type==="customer.subscription.created"||event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
  const userId=object?.metadata?.user_id;
  if(typeof userId==="string"){
   const {error}=await admin.from("subscriptions").update({provider:"stripe",provider_customer_id:typeof object.customer==="string"?object.customer:null,provider_subscription_id:object.id,status:object.status||"incomplete",trial_ends_at:isoFromUnix(object.trial_end),current_period_end:isoFromUnix(object.current_period_end)}).eq("user_id",userId);
   if(error)return NextResponse.json({error:"Could not update subscription record."},{status:500});
  }
 }else if(event.type==="checkout.session.completed"){
  const userId=object?.client_reference_id||object?.metadata?.user_id;
  if(typeof userId==="string"){
   const {error}=await admin.from("subscriptions").update({provider:"stripe",provider_customer_id:typeof object.customer==="string"?object.customer:null,provider_subscription_id:typeof object.subscription==="string"?object.subscription:null}).eq("user_id",userId);
   if(error)return NextResponse.json({error:"Could not link checkout customer."},{status:500});
  }
 }else if(event.type==="invoice.payment_failed"){
  const subscriptionId=typeof object?.subscription==="string"?object.subscription:object?.parent?.subscription_details?.subscription;
  if(typeof subscriptionId==="string"){
   const {error}=await admin.from("subscriptions").update({status:"past_due"}).eq("provider_subscription_id",subscriptionId);
   if(error)return NextResponse.json({error:"Could not update failed payment status."},{status:500});
  }
 }
 const {error:recordError}=await admin.from("stripe_events").insert({event_id:event.id,event_type:event.type});
 if(recordError&&recordError.code!=="23505")return NextResponse.json({error:"Could not record webhook event."},{status:500});
 return NextResponse.json({received:true});
}
