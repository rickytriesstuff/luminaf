import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {awardPoints} from "@/lib/billing/points";
import {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
const schema=z.object({amount_ml:z.number().int().min(1).max(5000),logged_at:z.string().datetime().optional()});
export async function GET(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const url=new URL(request.url),from=url.searchParams.get("from"),to=url.searchParams.get("to");
 let query=supabase.from("water_logs").select("id,amount_ml,logged_at").eq("user_id",user.id).order("logged_at",{ascending:false}).limit(200);
 if(from)query=query.gte("logged_at",from);
 if(to)query=query.lte("logged_at",to);
 const {data,error}=await query;
 if(error)return NextResponse.json({error:"Unable to load water logs."},{status:500});
 return NextResponse.json({logs:data??[]});
}
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});
 const parsed=schema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Water amount is invalid."},{status:400});
 const {data,error}=await supabase.from("water_logs").insert({user_id:user.id,...parsed.data}).select("id,amount_ml,logged_at").single();
 if(error)return NextResponse.json({error:"Unable to save water log."},{status:500});
 await awardPoints(user.id,1,"water_logged",data.id,8);
 return NextResponse.json({log:data}, {status:201});
}
