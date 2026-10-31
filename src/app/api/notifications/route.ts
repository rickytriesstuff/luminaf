import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("notifications").select("id,title,body,delivery_status,created_at,delivered_at,read_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
 if(error)return NextResponse.json({error:"Unable to load notifications."},{status:500});
 return NextResponse.json({notifications:data??[]},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const body:unknown=await request.json().catch(()=>null);
 const parsed=z.object({id:z.string().uuid()}).safeParse(body);
 if(!parsed.success)return NextResponse.json({error:"Notification ID is invalid."},{status:400});
 const {data,error}=await supabase.rpc("mark_my_notification_read",{p_notification_id:parsed.data.id});
 if(error)return NextResponse.json({error:"Unable to mark notification as read."},{status:500});
 return NextResponse.json({read:data===true});
}
