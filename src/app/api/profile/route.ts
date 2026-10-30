import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
const profileSchema=z.object({
 display_name:z.string().trim().min(1).max(80).optional(),
 birth_date:z.string().date().optional().nullable(),
 sex:z.enum(["female","male","other","prefer_not_to_say"]).optional().nullable(),
 height_cm:z.number().min(30).max(260).optional().nullable(),
 current_weight_kg:z.number().min(1).max(500).optional().nullable(),
 goal_weight_kg:z.number().min(1).max(500).optional().nullable(),
 activity_level:z.enum(["sedentary","light","moderate","active","very_active"]).optional().nullable(),
 wellness_goal:z.enum(["lose","maintain","gain"]).optional().nullable(),
 dietary_preferences:z.array(z.string().trim().min(1).max(40)).max(20).optional(),
 timezone:z.string().min(1).max(80).optional()
}).strict();
export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
 if(error)return NextResponse.json({error:"Profile is not available yet."},{status:503});
 return NextResponse.json({profile:data});
}
export async function PATCH(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const parsed=profileSchema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Profile details are invalid.",issues:parsed.error.flatten()},{status:400});
 const {data,error}=await supabase.from("profiles").update(parsed.data).eq("id",user.id).select("*").single();
 if(error)return NextResponse.json({error:"Unable to update profile."},{status:500});
 return NextResponse.json({profile:data});
}
