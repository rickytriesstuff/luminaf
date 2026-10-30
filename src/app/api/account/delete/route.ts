import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
export const runtime="nodejs";
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in before deleting your account."},{status:401});
 const parsed=z.object({confirmation:z.literal("DELETE")}).safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Type DELETE to confirm permanent account deletion."},{status:400});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:"Secure account deletion is not configured. Contact support."},{status:503});
 const admin=createAdminClient();
 const {data:billing,error:billingError}=await admin.from("subscriptions").select("provider_subscription_id,status").eq("user_id",user.id).maybeSingle();
 if(billingError)return NextResponse.json({error:"Could not verify billing status. Account was not deleted."},{status:503});
 if(billing?.provider_subscription_id&&!["canceled","incomplete_expired"].includes(billing.status)){
  const stripeKey=process.env.STRIPE_SECRET_KEY;
  if(!stripeKey)return NextResponse.json({error:"An active Stripe subscription is linked to this account, but secure cancellation is not configured. Contact support before deleting your account."},{status:503});
  const cancellation=await fetch("https://api.stripe.com/v1/subscriptions/"+encodeURIComponent(billing.provider_subscription_id),{method:"DELETE",headers:{Authorization:"Bearer "+stripeKey},cache:"no-store"});
  if(!cancellation.ok)return NextResponse.json({error:"Stripe could not confirm subscription cancellation. Your account was not deleted; please retry or contact support."},{status:502});
  const {error:billingUpdateError}=await admin.from("subscriptions").update({status:"canceled",current_period_end:new Date().toISOString()}).eq("user_id",user.id);
  if(billingUpdateError)return NextResponse.json({error:"Subscription was canceled, but account cleanup could not continue. Please retry account deletion."},{status:503});
 }
 for(let batch=0;batch<100;batch++){
  // Always read from offset zero because removing a page shifts later objects forward.
  const {data:objects,error:listError}=await admin.storage.from("meal-photos").list(user.id,{limit:1000,offset:0});
  if(listError)return NextResponse.json({error:"Could not prepare private photo deletion. Account was not deleted."},{status:500});
  if(!objects?.length)break;
  const paths=objects.filter(x=>x.name).map(x=>user.id+"/"+x.name);
  if(!paths.length)break;
  const {error:removeError}=await admin.storage.from("meal-photos").remove(paths);
  if(removeError)return NextResponse.json({error:"Could not remove private photos. Account was not deleted."},{status:500});
 }
 const {data:remaining,error:remainingError}=await admin.storage.from("meal-photos").list(user.id,{limit:1,offset:0});
 if(remainingError||remaining?.length)return NextResponse.json({error:"Private photo cleanup is incomplete. Account was not deleted; please retry or contact support."},{status:500});
 const {error}=await admin.auth.admin.deleteUser(user.id);
 if(error)return NextResponse.json({error:"Account deletion failed. Please contact support."},{status:500});
 return NextResponse.json({deleted:true});
}
