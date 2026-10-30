import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function GET(){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const since=new Date(Date.now()-30*86400000).toISOString();
 const [metrics,workouts,meals,habits,sleep,badges,points]=await Promise.all([
  supabase.from("body_metrics").select("weight_kg,measured_at").eq("user_id",user.id).gte("measured_at",since).order("measured_at",{ascending:true}),
  supabase.from("workouts").select("duration_seconds,started_at").eq("user_id",user.id).gte("started_at",since),
  supabase.from("meals").select("calories,logged_at").eq("user_id",user.id).gte("logged_at",since),
  supabase.from("habit_logs").select("completed_at").eq("user_id",user.id).gte("completed_at",since),
  supabase.from("sleep_logs").select("bedtime,wake_time,quality").eq("user_id",user.id).gte("bedtime",since),
  supabase.from("badges").select("id",{count:"exact",head:true}).eq("user_id",user.id),
  supabase.rpc("get_my_points")
 ]);
 const errors=[metrics.error,workouts.error,meals.error,habits.error,sleep.error,badges.error,points.error].filter(Boolean);
 if(errors.length)return NextResponse.json({error:"Unable to calculate progress right now."},{status:503});
 const mealDays=new Map<string,number>();
 for(const row of meals.data??[]){const day=row.logged_at.slice(0,10);mealDays.set(day,(mealDays.get(day)||0)+Number(row.calories||0));}
 const workoutDays=new Map<string,number>();
 for(const row of workouts.data??[]){const day=row.started_at.slice(0,10);workoutDays.set(day,(workoutDays.get(day)||0)+Number(row.duration_seconds||0)/60);}
 const habitDays=new Map<string,number>();
 for(const row of habits.data??[]){const day=row.completed_at.slice(0,10);habitDays.set(day,(habitDays.get(day)||0)+1);}
 const sleepHours=(sleep.data??[]).map(row=>(new Date(row.wake_time).getTime()-new Date(row.bedtime).getTime())/3600000).filter(x=>x>0&&x<=24);
 const workoutMinutes=(workouts.data??[]).reduce((sum,row)=>sum+Number(row.duration_seconds||0)/60,0);
 return NextResponse.json({
  points:Number(points.data)||0,badges:badges.count||0,
  weight:metrics.data??[],workouts:{sessions:workouts.data?.length??0,minutes:Math.round(workoutMinutes),daily_minutes:Array.from(workoutDays.entries()).map(([date,minutes])=>({date,minutes:Math.round(minutes)}))},
  meals:{entries:meals.data?.length??0,daily_calories:Array.from(mealDays.entries()).map(([date,calories])=>({date,calories}))},
  habits:{checkins:habits.data?.length??0,daily_checkins:Array.from(habitDays.entries()).map(([date,checkins])=>({date,checkins}))},sleep:{entries:sleepHours.length,average_hours:sleepHours.length?Number((sleepHours.reduce((a,b)=>a+b,0)/sleepHours.length).toFixed(1)):null,average_quality:sleep.data?.length?Number(((sleep.data.reduce((a,row)=>a+Number(row.quality||0),0))/sleep.data.length).toFixed(1)):null}
 });
}
