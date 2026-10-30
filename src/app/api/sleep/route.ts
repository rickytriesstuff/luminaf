import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {awardPoints} from "@/lib/billing/points";
import {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
const schema=z.object({bedtime:z.string().datetime(),wake_time:z.string().datetime(),quality:z.number().int().min(1).max(5),notes:z.string().max(500).optional()}).refine(v=>new Date(v.wake_time)>new Date(v.bedtime)&&new Date(v.wake_time).getTime()-new Date(v.bedtime).getTime()<=24*60*60*1000);
export async function POST(request:Request){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to log sleep."},{status:401});
 if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:"Sleep times are invalid. Wake time must follow bedtime within 24 hours."},{status:400});const {data,error}=await supabase.from("sleep_logs").insert({user_id:user.id,...parsed.data}).select("id").single();if(error)return NextResponse.json({error:"Unable to save sleep log."},{status:500});await awardPoints(user.id,3,"sleep_logged",data.id,1);return NextResponse.json({id:data.id,saved:true});}
