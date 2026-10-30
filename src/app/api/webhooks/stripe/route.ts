import {createHmac,timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {z} from "zod";
import {createAdminClient} from "@/lib/supabase/admin";
export const runtime="nodejs";
const eventSchema=z.object({id:z.string().min(1),type:z.string().min(1),data:z.object({object:z.record(z.unknown())})});
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
function record(value:unknown):Record<string,unknown>{return value!==null&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function stringValue(value:unknown){return typeof value==="string"?value:null;}
export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET;
 if(!secret)return NextResponse.json({error:"Webhook is not configured."},{status:503});
 const body=await request.text(),signature=request.headers.get("stripe-signature")||"";
 if(!validSignature(body,signature,secret))return NextResponse.json({error:"Invalid webhook signature."},{status:400});
 let decoded:unknown;
 try{decoded=JSON.parse(body);}catch{return NextResponse.json({error:"Invalid event payload."},{status:400});}
 const parsed=eventSchema.safeParse(decoded);
 if(!parsed.success)return NextResponse.json({error:"Invalid event envelope."},{status:400});
 const event=parsed.data,object=event.data.object,metadata=record(object.metadata);
 const admin=createAdminClient();
 const {data:seen}=await admin.from("stripe_events").select("event_id").eq("event_id",event.id).maybeSingle();
 if(seen)return NextResponse.json({received:true,duplicate:true});
 if(event.type==="customer.subscription.created"||event.type==="customer.subscription.updated"||event.type==="customer.subscription.deleted"){
  const userId=stringValue(metadata.user_id),subscriptionId=stringValue(object.id),status=stringValue(object.status)||"incomplete";
  if(userId&&subscriptionId){
   const {error}=await admin.from("subscriptions").update({provider:"stripe",provider_customer_id:stringValue(object.customer),provider_subscription_id:subscriptionId,status,trial_ends_at:isoFromUnix(object.trial_end),current_period_end:isoFromUnix(object.current_period_end)}).eq("user_id",userId);
   if(error)return NextResponse.json({error:"Could not update subscription record."},{status:500});
  }
 }else if(event.type==="checkout.session.completed"){
  const userId=stringValue(object.client_reference_id)||stringValue(metadata.user_id);
  if(userId){
   const {error}=await admin.from("subscriptions").update({provider:"stripe",provider_customer_id:stringValue(object.customer),provider_subscription_id:stringValue(object.subscription)}).eq("user_id",userId);
   if(error)return NextResponse.json({error:"Could not link checkout customer."},{status:500});
  }
 }else if(event.type==="invoice.payment_failed"){
  const parent=record(object.parent),details=record(parent.subscription_details);
  const subscriptionId=stringValue(object.subscription)||stringValue(details.subscription);
  if(subscriptionId){
   const {error}=await admin.from("subscriptions").update({status:"past_due"}).eq("provider_subscription_id",subscriptionId);
   if(error)return NextResponse.json({error:"Could not update failed payment status."},{status:500});
  }
 }
 const {error:recordError}=await admin.from("stripe_events").insert({event_id:event.id,event_type:event.type});
 if(recordError&&recordError.code!=="23505")return NextResponse.json({error:"Could not record webhook event."},{status:500});
 return NextResponse.json({received:true});
}
