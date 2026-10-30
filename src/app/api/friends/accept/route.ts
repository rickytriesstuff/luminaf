import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
export async function POST(request:Request){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to accept this invitation."},{status:401});
 if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});const body=z.object({token:z.string().min(32).max(100)}).safeParse(await request.json());if(!body.success)return NextResponse.json({error:"Invitation link is invalid."},{status:400});const {data,error}=await supabase.rpc("accept_friend_invite",{p_token:body.data.token});if(error)return NextResponse.json({error:"Unable to accept invitation."},{status:400});if(data!==true)return NextResponse.json({error:"This invitation has expired or was already used."},{status:410});return NextResponse.json({accepted:true});}
