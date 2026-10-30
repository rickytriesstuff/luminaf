import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
const schema=z.object({weight_kg:z.number().min(1).max(500).optional(),height_cm:z.number().min(30).max(260).optional(),waist_cm:z.number().min(20).max(250).optional(),measured_at:z.string().datetime().optional()}).refine(v=>v.weight_kg!==undefined||v.height_cm!==undefined||v.waist_cm!==undefined);
export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("body_metrics").select("id,weight_kg,height_cm,waist_cm,measured_at").eq("user_id",user.id).order("measured_at",{ascending:false}).limit(365);
 if(error)return NextResponse.json({error:"Unable to load body metrics."},{status:500});
 return NextResponse.json({metrics:data??[]});
}
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});
 const parsed=schema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Metric values are invalid."},{status:400});
 const {data,error}=await supabase.from("body_metrics").insert({user_id:user.id,...parsed.data}).select("id,weight_kg,height_cm,waist_cm,measured_at").single();
 if(error)return NextResponse.json({error:"Unable to save measurement."},{status:500});
 return NextResponse.json({metric:data},{status:201});
}
