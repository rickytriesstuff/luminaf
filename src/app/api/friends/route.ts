import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to view friends."},{status:401});const {data,error}=await supabase.rpc("get_friends_zone");if(error)return NextResponse.json({error:"Unable to load friends. Apply the friends migration."},{status:503});return NextResponse.json({friends:data??[]});}
