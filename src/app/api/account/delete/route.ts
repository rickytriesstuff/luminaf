import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
export const runtime="nodejs";
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in before deleting your account."},{status:401});
 const parsed=z.object({confirmation:z.literal("DELETE")}).safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Type DELETE to confirm permanent account deletion."},{status:400});
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:"Secure account deletion is not configured. Contact support."},{status:503});
 const admin=createAdminClient();
 const {data:objects,error:listError}=await admin.storage.from("meal-photos").list(user.id,{limit:1000});
 if(listError)return NextResponse.json({error:"Could not prepare private photo deletion. Account was not deleted."},{status:500});
 if(objects?.length){
  const paths=objects.filter(x=>x.name).map(x=>user.id+"/"+x.name);
  const {error:removeError}=await admin.storage.from("meal-photos").remove(paths);
  if(removeError)return NextResponse.json({error:"Could not remove private photos. Account was not deleted."},{status:500});
 }
 const {error}=await admin.auth.admin.deleteUser(user.id);
 if(error)return NextResponse.json({error:"Account deletion failed. Please contact support."},{status:500});
 return NextResponse.json({deleted:true});
}
