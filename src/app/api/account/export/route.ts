import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export const runtime="nodejs";
export async function GET(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to export your data."},{status:401});
 const tables=["body_metrics","meals","meal_items","water_logs","workouts","workout_sets","fitness_plans","sleep_logs","habits","habit_logs","symptom_checks","reminders","notifications","push_subscriptions","points_ledger","badges","subscriptions","friend_invites"];
 const entries=await Promise.all(tables.map(async table=>{
  const {data,error}=await supabase.from(table).select("*").eq("user_id",user.id).limit(5000);
  // Some relationship tables use inviter_id rather than user_id and are exported separately below.
  if(error&&error.code!=="42703")return {table,error:"Could not export this data category."};
  return {table,records:data??[]};
 }));
 const [{data:profile},{data:friendships},{data:invites}]=await Promise.all([
  supabase.from("profiles").select("*").eq("id",user.id).maybeSingle(),
  supabase.from("friendships").select("*").or("requester_id.eq."+user.id+",addressee_id.eq."+user.id),
  supabase.from("friend_invites").select("*").eq("inviter_id",user.id)
 ]);
 const payload={product:"Luminaf",exported_at:new Date().toISOString(),account:{id:user.id,email:user.email??null,created_at:user.created_at},profile,friendships:friendships??[],friend_invites:invites??[],data:entries};
 return new NextResponse(JSON.stringify(payload,null,2),{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":"attachment; filename=luminaf-data-export.json","Cache-Control":"private, no-store"}});
}
