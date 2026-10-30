import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("fitness_plans").select("id,title,plan,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20);
 if(error)return NextResponse.json({error:"Unable to load saved plans."},{status:500});
 return NextResponse.json({plans:data??[]});
}
