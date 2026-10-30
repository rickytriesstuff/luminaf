import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
const endpointSchema=z.string().url().max(2048).refine(value=>{const url=new URL(value);const host=url.hostname.toLowerCase();return url.protocol==="https:"&&(host==="fcm.googleapis.com"||host.endsWith(".fcm.googleapis.com")||host.endsWith(".push.services.mozilla.com")||host.endsWith(".push.apple.com")||host==="web.push.apple.com"||host==="notify.windows.com"||host.endsWith(".notify.windows.com"));});
const schema=z.object({endpoint:endpointSchema,expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().min(20).max(200),auth:z.string().min(10).max(100)})});
export async function POST(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to enable notifications."},{status:401});
 if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});
 const parsed=schema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Push subscription is invalid."},{status:400});
 const {error}=await supabase.from("push_subscriptions").upsert({user_id:user.id,endpoint:parsed.data.endpoint,subscription:parsed.data},{onConflict:"endpoint"});
 if(error)return NextResponse.json({error:"Unable to save this device's notification subscription."},{status:500});
 return NextResponse.json({subscribed:true},{status:201});
}
export async function DELETE(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const parsed=z.object({endpoint:endpointSchema}).safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Push endpoint is invalid."},{status:400});
 const {error}=await supabase.from("push_subscriptions").delete().eq("user_id",user.id).eq("endpoint",parsed.data.endpoint);
 if(error)return NextResponse.json({error:"Unable to remove this device."},{status:500});
 return NextResponse.json({subscribed:false});
}
