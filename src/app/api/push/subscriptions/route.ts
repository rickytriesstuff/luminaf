import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
const schema=z.object({
 endpoint:z.string().url().refine(value=>{try{const url=new URL(value),host=url.hostname.toLowerCase();return url.protocol==="https:"&&(host==="fcm.googleapis.com"||host==="updates.push.services.mozilla.com"||host.endsWith(".push.services.mozilla.com")||host.endsWith(".push.apple.com")||host.endsWith(".notify.windows.com"));}catch{return false;}},"Push endpoint must use a supported browser push service over HTTPS."),
 expirationTime:z.number().nullable().optional(),
 keys:z.object({p256dh:z.string().min(20).max(256),auth:z.string().min(10).max(128)}).strict()
}).strict();
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const body:unknown=await request.json().catch(()=>null);
 const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:"Push subscription details are invalid."},{status:400});
 const subscription=parsed.data;
 const {error}=await supabase.from("push_subscriptions").upsert({
  user_id:user.id,endpoint:subscription.endpoint,subscription
 },{onConflict:"endpoint"});
 if(error)return NextResponse.json({error:"Unable to save this device subscription. It may already belong to another account."},{status:409});
 return NextResponse.json({saved:true},{status:201});
}
export async function DELETE(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const body:unknown=await request.json().catch(()=>null);
 const parsed=z.object({endpoint:z.string().url()}).safeParse(body);
 if(!parsed.success)return NextResponse.json({error:"Push endpoint is invalid."},{status:400});
 const {error}=await supabase.from("push_subscriptions").delete().eq("user_id",user.id).eq("endpoint",parsed.data.endpoint);
 if(error)return NextResponse.json({error:"Unable to remove this device."},{status:500});
 return NextResponse.json({removed:true});
}
