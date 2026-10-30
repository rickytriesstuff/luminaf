import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const [{data:total,error:totalError},{data:recent,error:recentError}]=await Promise.all([
  supabase.rpc("get_my_points"),
  supabase.from("points_ledger").select("id,points,reason,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20)
 ]);
 if(totalError||recentError)return NextResponse.json({error:"Unable to load your points."},{status:503});
 const points=Number(total)||0;
 return NextResponse.json({total:points,level:Math.floor(points/100)+1,level_progress:points%100,next_level_at:(Math.floor(points/100)+1)*100,recent:recent??[]});
}
