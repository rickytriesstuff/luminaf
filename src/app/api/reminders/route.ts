import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";\nimport {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
const schema=z.object({id:z.string().uuid().optional(),kind:z.string().trim().min(1).max(40),local_time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional().nullable(),timezone:z.string().min(1).max(80),enabled:z.boolean(),quiet_hours:z.object({enabled:z.boolean(),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).optional()});
export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const {data,error}=await supabase.from("reminders").select("id,kind,local_time,timezone,enabled,quiet_hours").eq("user_id",user.id).order("kind");
 if(error)return NextResponse.json({error:"Unable to load reminders."},{status:500});
 return NextResponse.json({reminders:data??[]});
}
export async function PUT(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});\n if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});
 const parsed=z.array(schema.omit({id:true})).max(30).safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Reminder settings are invalid."},{status:400});
 const rows=parsed.data.map(v=>({...v,user_id:user.id}));
 const {data,error}=await supabase.from("reminders").upsert(rows,{onConflict:"user_id,kind"}).select("id,kind,local_time,timezone,enabled,quiet_hours");
 if(error)return NextResponse.json({error:"Unable to save reminder preferences."},{status:500});
 return NextResponse.json({reminders:data??[]});
}
