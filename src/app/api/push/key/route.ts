import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const key=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||process.env.VAPID_PUBLIC_KEY;
 if(!key)return NextResponse.json({error:"Push notifications are not configured yet."},{status:503});
 return NextResponse.json({publicKey:key},{headers:{"Cache-Control":"private, no-store"}});
}
