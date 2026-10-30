import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sign in to view exercises."},{status:401});const {data,error}=await supabase.from("exercises").select("id,name,category,instructions,difficulty").order("category").order("name");if(error)return NextResponse.json({error:"Exercise library is unavailable. Apply the seed migration."},{status:503});return NextResponse.json({exercises:data??[]});}
