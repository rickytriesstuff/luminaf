import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";\nimport {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
const schema=z.object({name:z.string().trim().min(1).max(80),target:z.string().max(120).optional()});
export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("habits").select("id,name,target,active,created_at").eq("user_id",user.id).order("created_at",{ascending:true});
 if(error)return NextResponse.json({error:"Unable to load habits."},{status:500});
 return NextResponse.json({habits:data??[]});
}
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});\n if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});
 const parsed=schema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Habit details are invalid."},{status:400});
 const {data,error}=await supabase.from("habits").insert({user_id:user.id,...parsed.data}).select("id,name,target,active,created_at").single();
 if(error)return NextResponse.json({error:"Unable to create habit."},{status:500});
 return NextResponse.json({habit:data},{status:201});
}
