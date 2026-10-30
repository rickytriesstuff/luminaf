import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
export const runtime="nodejs";
const requestSchema=z.object({goal:z.enum(["general","strength","cardio","mobility","stress"]),level:z.enum(["beginner","intermediate","advanced"]),days_per_week:z.number().int().min(2).max(6),minutes_per_session:z.number().int().min(10).max(90),weather:z.object({condition:z.string().max(50),temperature_c:z.number().min(-60).max(60),precipitation_mm:z.number().min(0).max(500),wind_kmh:z.number().min(0).max(300)}).optional()});
const daySchema=z.object({day:z.number().int().min(1).max(7),title:z.string().min(1).max(80),activity:z.string().min(1).max(160),duration_minutes:z.number().int().min(0).max(120),intensity:z.enum(["rest","easy","moderate","challenging"]),instructions:z.array(z.string().min(1).max(180)).min(1).max(6)});
const planSchema=z.object({title:z.string().min(1).max(100),summary:z.string().min(1).max(500),days:z.array(daySchema).length(7)});
const responseSchema={type:"object",additionalProperties:false,properties:{title:{type:"string"},summary:{type:"string"},days:{type:"array",minItems:7,maxItems:7,items:{type:"object",additionalProperties:false,properties:{day:{type:"integer",minimum:1,maximum:7},title:{type:"string"},activity:{type:"string"},duration_minutes:{type:"integer",minimum:0,maximum:120},intensity:{type:"string",enum:["rest","easy","moderate","challenging"]},instructions:{type:"array",items:{type:"string"}}},required:["day","title","activity","duration_minutes","intensity","instructions"]}}},required:["title","summary","days"]};
export async function POST(request:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to generate a plan."},{status:401});
 if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});
 const parsed=requestSchema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Plan preferences are invalid."},{status:400});
 const apiKey=process.env.OPENAI_API_KEY;
 if(!apiKey)return NextResponse.json({error:"AI plan generation is not configured. Add OPENAI_API_KEY on the server."},{status:503});
 const {data:allowed,error:limitError}=await supabase.rpc("consume_ai_request",{p_endpoint:"fitness_plan",p_hourly_limit:5});
 if(limitError)return NextResponse.json({error:"Plan generation is not configured. Apply the latest database migrations."},{status:503});
 if(allowed!==true)return NextResponse.json({error:"You've reached the limit of five AI plans per hour. Try again later."},{status:429});
 const input=parsed.data,model=process.env.OPENAI_TEXT_MODEL||"gpt-4o-mini";
 const context={goal:input.goal,experience:input.level,active_days_per_week:input.days_per_week,maximum_minutes_per_session:input.minutes_per_session,local_weather:input.weather??null};
 const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({model,temperature:0.35,response_format:{type:"json_schema",json_schema:{name:"weekly_wellness_plan",strict:true,schema:responseSchema}},messages:[{role:"system",content:"Create a conservative, practical seven-day general fitness and wellbeing plan. This is general educational wellness content, not medical advice or treatment. Respect the requested experience level, number of active days and session duration. Include at least one full rest day and never schedule more active days than requested. Include warm-up/cool-down in instructions. Use low-impact options for beginners. Avoid dangerous challenges, extreme calorie or weight-loss prescriptions, and medical claims. If weather indicates rain, storms, high wind or extreme temperatures, prefer indoor activities. Use exactly seven days numbered 1 through 7. Rest days must have duration_minutes 0 and intensity rest."},{role:"user",content:"Generate a weekly plan using these preferences: "+JSON.stringify(context)}]})});
 if(!response.ok){const body=await response.text();console.error("Fitness plan provider error",response.status,body.slice(0,300));return NextResponse.json({error:"AI plan generation is temporarily unavailable."},{status:502});}
 const payload=await response.json(),raw=payload.choices?.[0]?.message?.content;
 if(typeof raw!=="string")return NextResponse.json({error:"The plan generator returned no usable plan."},{status:502});
 let decoded:unknown;try{decoded=JSON.parse(raw);}catch{return NextResponse.json({error:"The generated plan was not valid structured data."},{status:502});}
 const validated=planSchema.safeParse(decoded);
 if(!validated.success)return NextResponse.json({error:"The generated plan did not pass safety and format checks. Please try again."},{status:502});
 const days=[...validated.data.days].sort((a,b)=>a.day-b.day);
 const activeDays=days.filter(day=>day.intensity!=="rest");
 if(days.some((day,index)=>day.day!==index+1)||activeDays.length!==input.days_per_week||!days.some(day=>day.intensity==="rest")||days.some(day=>day.intensity==="rest"?day.duration_minutes!==0:day.duration_minutes===0||day.duration_minutes>input.minutes_per_session)||input.level==="beginner"&&days.some(day=>day.intensity==="challenging")||days.some((day,index)=>day.intensity==="challenging"&&days[index+1]?.intensity==="challenging"))return NextResponse.json({error:"The generated plan did not fit your schedule safely. Please try again."},{status:502});
 const plan={...validated.data,days,preferences:context,generated_at:new Date().toISOString(),safety_note:"General wellness guidance only. Adapt activities to your ability and stop if you feel pain, dizzy or unwell."};
 const {data:saved,error}=await supabase.from("fitness_plans").insert({user_id:user.id,title:plan.title,plan}).select("id,title,plan,created_at").single();
 if(error)return NextResponse.json({error:"The plan was generated but could not be saved."},{status:500});
 return NextResponse.json({plan:saved},{status:201});
}
