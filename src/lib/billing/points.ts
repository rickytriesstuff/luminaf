import {createAdminClient} from "@/lib/supabase/admin";
type AwardReason="meal_logged"|"water_logged"|"workout_completed"|"sleep_logged"|"habit_completed";
export async function awardPoints(userId:string,points:number,reason:AwardReason,sourceId:string,dailyLimit:number){
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return;
 try{
  const admin=createAdminClient();
  const {error}=await admin.rpc("award_points",{p_user_id:userId,p_points:points,p_reason:reason,p_source_id:sourceId,p_daily_limit:dailyLimit});
  if(error)console.error("Points award failed",reason,error.message);
 }catch(error){console.error("Points award unavailable",reason,error);}
}
