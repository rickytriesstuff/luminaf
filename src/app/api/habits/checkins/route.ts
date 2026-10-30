import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
const schema=z.object({habit_id:z.string().uuid()});
export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const start=new Date();start.setUTCHours(0,0,0,0);
 const end=new Date(start);end.setUTCDate(end.getUTCDate()+1);
 const {data,error}=await supabase.from("habit_logs").select("id,habit_id,completed_at").eq("user_id",user.id).gte("completed_at",start.toISOString()).lt("completed_at",end.toISOString());
 if(error)return NextResponse.json({error:"Unable to load habit check-ins."},{status:500});
 return NextResponse.json({checkins:data??[]});
}
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});
 const parsed=schema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Habit ID is invalid."},{status:400});
 const {data:habit}=await supabase.from("habits").select("id").eq("id",parsed.data.habit_id).eq("user_id",user.id).single();
 if(!habit)return NextResponse.json({error:"Habit not found."},{status:404});
 const {data,error}=await supabase.from("habit_logs").insert({habit_id:habit.id,user_id:user.id}).select("id,habit_id,completed_at").single();
 if(error?.code==="23505")return NextResponse.json({error:"This habit is already checked in today."},{status:409});
 if(error)return NextResponse.json({error:"Unable to save check-in."},{status:500});
 return NextResponse.json({checkin:data},{status:201});
}
