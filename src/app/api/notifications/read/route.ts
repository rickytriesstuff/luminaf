import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
export async function POST(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const parsed=z.object({id:z.string().uuid()}).safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Notification ID is invalid."},{status:400});
 const {data,error}=await supabase.rpc("mark_notification_read",{p_notification_id:parsed.data.id});
 if(error)return NextResponse.json({error:"Unable to mark notification as read."},{status:500});
 if(data!==true)return NextResponse.json({error:"Notification not found."},{status:404});
 return NextResponse.json({read:true});
}
