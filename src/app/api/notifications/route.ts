import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("notifications").select("id,title,body,delivery_status,created_at,delivered_at,read_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(50);
 if(error)return NextResponse.json({error:"Unable to load notifications."},{status:500});
 return NextResponse.json({notifications:data??[],unread:(data??[]).filter(x=>!x.read_at).length});
}
