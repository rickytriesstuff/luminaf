import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE_URL = (Deno.env.get("SITE_URL") || "https://rickytriesstuff.github.io").replace(/\/$/, "");
const SITE_BASE_PATH = (Deno.env.get("SITE_BASE_PATH") || "/luminaf").replace(/\/$/, "");
const ALLOWED = new Set([SITE_URL, "https://rickytriesstuff.github.io", "http://localhost:3000", "http://127.0.0.1:3000"]);
const cors = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED.has(origin) ? origin : SITE_URL,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, stripe-signature",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
});
const json = (body: unknown, status = 200, headers: Record<string,string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type":"application/json", "Cache-Control":"no-store", ...headers } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const obj = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const validNum = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const validDate = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
const validClock = (v: unknown) => typeof v === "string" && /^([01]\\d|2[0-3]):[0-5]\\d$/.test(v);
const validMealItem = (x: any) => {
  const n=obj(x?.nutrition);
  return typeof x?.name==="string" && x.name.trim().length>=1 && x.name.length<=100 &&
    validNum(x?.portion_grams,1,3000) && (x?.confidence===undefined || validNum(x.confidence,0,1)) &&
    validNum(n.calories,0,5000) && validNum(n.protein_g,0,300) && validNum(n.carbs_g,0,500) &&
    validNum(n.fat_g,0,300) && validNum(n.fiber_g,0,150) && validNum(n.sugar_g,0,250) && validNum(n.sodium_mg,0,15000);
};
const validMealType = (v: unknown) => v===undefined || ["breakfast","lunch","dinner","snack"].includes(String(v));
const validPushEndpoint = (value: unknown) => {
  if(typeof value!=="string")return false;
  try { const u=new URL(value),h=u.hostname.toLowerCase(); return u.protocol==="https:" &&
    (h==="fcm.googleapis.com" || h==="updates.push.services.mozilla.com" ||
     h.endsWith(".push.services.mozilla.com") || h.endsWith(".push.apple.com") ||
     h.endsWith(".notify.windows.com")); } catch { return false; }
};
const enc = (v: Uint8Array) => btoa(String.fromCharCode(...v));
const dec = (v: string) => Uint8Array.from(atob(v), c => c.charCodeAt(0));

async function award(admin: SupabaseClient, userId: string, points: number, reason: string, sourceId: string, dailyLimit: number) {
  if (!SERVICE_KEY) return;
  await admin.rpc("award_points", { p_user_id:userId, p_points:points, p_reason:reason, p_source_id:sourceId, p_daily_limit:dailyLimit });
}
async function entitlement(db: SupabaseClient, userId: string) {
  const { data } = await db.from("subscriptions").select("status,trial_ends_at,current_period_end").eq("user_id",userId).maybeSingle();
  if (!data) return false;
  const now=Date.now(), trial=Date.parse(data.trial_ends_at||"")||0, period=Date.parse(data.current_period_end||"")||0;
  return (data.status==="trialing" && trial>now) || (["active","past_due"].includes(data.status) && period>now);
}
const needEntitlement = () => ({error:"Your free trial has ended. Choose a plan to continue using this feature.",code:"SUBSCRIPTION_REQUIRED"});

async function stripeRequest(path: string, secret: string, body: URLSearchParams, method = "POST") {
  return await fetch("https://api.stripe.com/v1/"+path,{method,headers:{Authorization:"Bearer "+secret,"Content-Type":"application/x-www-form-urlencoded"},body:method==="GET"?undefined:body.toString()});
}
async function verifyStripe(body: string, header: string, secret: string) {
  const parts=header.split(",").map(x=>x.split("=")), ts=parts.find(x=>x[0]==="t")?.[1], signatures=parts.filter(x=>x[0]==="v1").map(x=>x[1]);
  if(!ts||!Number.isFinite(Number(ts))||!signatures.length||Math.abs(Date.now()/1000-Number(ts))>300)return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(ts+"."+body)));
  const expected=[...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
  return signatures.some(s=>s===expected);
}

Deno.serve(async (req) => {
  const origin=req.headers.get("origin"), headers=cors(origin);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  const url=new URL(req.url), path=url.searchParams.get("path")||"/", routeParams=new URLSearchParams(url.searchParams.get("query")||""), method=req.method;
  const endpoint=path.replace(/^\/api\//,"").replace(/\/$/,"");
  const authHeader=req.headers.get("authorization")||"";
  const token=authHeader.startsWith("Bearer ")?authHeader.slice(7):"";
  const db=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:token?{Authorization:"Bearer "+token}:{}}});
  const admin=SERVICE_KEY?createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}):null;
  const userResult=token?await db.auth.getUser(token):{data:{user:null},error:null};
  const user=userResult.data.user;
  const requireUser=()=>user?null:fail("Sign in required.",401);
  const body=async()=>{try{return await req.json()}catch{return null}};
  const respond=async (p:Promise<Response>)=>{const r=await p;const h=new Headers(r.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);return new Response(r.body,{status:r.status,headers:h});};
  const failRequest=(message:string,status=400)=>json({error:message},status,headers);
  try {
    // Stripe sends its own signature, not a Supabase user JWT.
    if(endpoint==="webhooks/stripe"&&method==="POST"){
      const secret=Deno.env.get("STRIPE_WEBHOOK_SECRET");if(!secret)return json({error:"Webhook is not configured."},503,headers);
      const raw=await req.text();if(!await verifyStripe(raw,req.headers.get("stripe-signature")||"",secret))return json({error:"Invalid webhook signature."},400,headers);
      const event=obj(JSON.parse(raw)), data=obj(obj(event.data).object), metadata=obj(data.metadata);
      if(!admin)return json({error:"Server database key is not configured."},503,headers);
      const {data:seen}=await admin.from("stripe_events").select("event_id").eq("event_id",event.id).maybeSingle();
      if(seen)return json({received:true,duplicate:true},200,headers);
      if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted","customer.subscription.trial_will_end"].includes(event.type)){
        const uid=metadata.user_id, sid=data.id;
        if(uid&&sid){
          const status=data.status||"incomplete";
          const {error}=await admin.from("subscriptions").update({provider:"stripe",provider_customer_id:data.customer,provider_subscription_id:sid,status,trial_ends_at:status==="trialing"&&data.trial_end?new Date(data.trial_end*1000).toISOString():null,current_period_end:data.current_period_end?new Date(data.current_period_end*1000).toISOString():null}).eq("user_id",uid);
          if(error)return json({error:"Could not update subscription."},500,headers);
        }
      } else if(event.type==="checkout.session.completed"){
        const uid=data.client_reference_id||metadata.user_id;
        if(uid){const {error}=await admin.from("subscriptions").update({provider:"stripe",provider_customer_id:data.customer,provider_subscription_id:data.subscription}).eq("user_id",uid);if(error)return json({error:"Could not link customer."},500,headers);}
      } else if(event.type==="invoice.payment_failed"){
        const sid=data.subscription||obj(obj(data.parent).subscription_details).subscription;
        if(sid){const {error}=await admin.from("subscriptions").update({status:"past_due"}).eq("provider_subscription_id",sid);if(error)return json({error:"Could not update payment status."},500,headers);}
      }
      const {error}=await admin.from("stripe_events").insert({event_id:event.id,event_type:event.type});
      if(error&&error.code!=="23505")return json({error:"Could not record event."},500,headers);
      return json({received:true},200,headers);
    }

    if(endpoint==="health/symptoms")return json({error:"Symptom screening is disabled in this release. For severe, sudden or worsening symptoms, seek urgent medical care."},503,headers);
    if(endpoint==="weather"&&method==="GET"){
      if(!user)return failRequest("Sign in to check local weather.",401);
      const lat=Number(routeParams.get("lat")),lon=Number(routeParams.get("lon"));
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return failRequest("A valid location is required.",400);
      const params=new URLSearchParams({latitude:String(lat),longitude:String(lon),current:"temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",timezone:"auto"});
      const w=await fetch("https://api.open-meteo.com/v1/forecast?"+params.toString());
      if(!w.ok)return failRequest("Weather service is temporarily unavailable.",502);
      const payload=obj(await w.json()),current=obj(payload.current);
      if(!Object.keys(current).length)return failRequest("Weather data is unavailable for this location.",502);
      const code=Number(current.weather_code),rain=Number(current.precipitation)||0,temp=Number(current.temperature_2m),wind=Number(current.wind_speed_10m)||0;
      const condition=code===0?"Clear":[1,2].includes(code)?"Mostly clear":code===3?"Overcast":[45,48].includes(code)?"Fog":[51,53,55,56,57].includes(code)?"Drizzle":[61,63,65,66,67,80,81,82].includes(code)?"Rain":[71,73,75,77,85,86].includes(code)?"Snow":[95,96,99].includes(code)?"Thunderstorm":"Variable conditions";
      const suggestion=rain>0||wind>40||temp>35||temp<0||[45,48,61,63,65,66,67,71,73,75,80,81,82,85,86,95,96,99].includes(code)?"An indoor session may be more comfortable right now.":"Conditions may suit a comfortable outdoor session. Check local conditions before heading out.";
      return json({temperature_c:current.temperature_2m,feels_like_c:current.apparent_temperature,precipitation_mm:rain,wind_kmh:wind,weather_code:code,condition,suggestion,timezone:payload.timezone},200,headers);
    }
    if(endpoint==="push/key"&&method==="GET")return json({publicKey:Deno.env.get("VAPID_PUBLIC_KEY")||""},200,headers);

    const authError=requireUser();if(authError)return await respond(Promise.resolve(authError));
    const uid=user!.id;
    const canWrite=async()=>await entitlement(db,uid);
    const readRange=(q:any)=>{const from=routeParams.get("from"),to=routeParams.get("to");if(from)q=q.gte("logged_at",from);if(to)q=q.lte("logged_at",to);return q;};

    if(endpoint==="water"&&method==="GET"){
      const {data,error}=await readRange(db.from("water_logs").select("id,amount_ml,logged_at").eq("user_id",uid).order("logged_at",{ascending:false}).limit(200));
      return json(error?{error:"Unable to load water logs."}:{logs:data||[]},error?500:200,headers);
    }
    if(endpoint==="water"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);
      const b=obj(await body());if(!validNum(b.amount_ml,1,5000)||!Number.isInteger(b.amount_ml)||(b.logged_at&&!validDate(b.logged_at)))return failRequest("Water amount is invalid.",400);
      const {data,error}=await db.from("water_logs").insert({user_id:uid,amount_ml:b.amount_ml,logged_at:b.logged_at}).select("id,amount_ml,logged_at").single();
      if(error)return failRequest("Unable to save water log.",500);if(admin)await award(admin,uid,1,"water_logged",data.id,8);
      return json({log:data},201,headers);
    }
    if(endpoint==="habits"&&method==="GET"){
      const {data,error}=await db.from("habits").select("id,name,target,active,created_at").eq("user_id",uid).order("created_at");
      return json(error?{error:"Unable to load habits."}:{habits:data||[]},error?500:200,headers);
    }
    if(endpoint==="habits"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);
      const b=obj(await body());if(typeof b.name!=="string"||!b.name.trim()||b.name.length>80||typeof b.target==="string"&&b.target.length>120)return failRequest("Habit details are invalid.",400);
      const {data,error}=await db.from("habits").insert({user_id:uid,name:b.name.trim(),target:b.target||null}).select("id,name,target,active,created_at").single();
      return json(error?{error:"Unable to create habit."}:{habit:data},error?500:201,headers);
    }
    if(endpoint==="habits/checkins"&&method==="GET"){
      const start=new Date();start.setUTCHours(0,0,0,0);const end=new Date(start);end.setUTCDate(end.getUTCDate()+1);
      const {data,error}=await db.from("habit_logs").select("id,habit_id,completed_at").eq("user_id",uid).gte("completed_at",start.toISOString()).lt("completed_at",end.toISOString());
      return json(error?{error:"Unable to load habit check-ins."}:{checkins:data||[]},error?500:200,headers);
    }
    if(endpoint==="habits/checkins"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);const b=obj(await body());
      const {data:habit}=await db.from("habits").select("id").eq("id",b.habit_id).eq("user_id",uid).maybeSingle();if(!habit)return failRequest("Habit not found.",404);
      const {data,error}=await db.from("habit_logs").insert({habit_id:habit.id,user_id:uid}).select("id,habit_id,completed_at").single();
      if(error?.code==="23505")return failRequest("This habit is already checked in today.",409);if(error)return failRequest("Unable to save check-in.",500);
      if(admin)await award(admin,uid,3,"habit_completed",data.id,5);return json({checkin:data},201,headers);
    }
    if(endpoint==="metrics"&&(method==="GET"||method==="POST")){
      if(method==="GET"){const {data,error}=await db.from("body_metrics").select("id,weight_kg,height_cm,waist_cm,measured_at").eq("user_id",uid).order("measured_at",{ascending:false}).limit(365);return json(error?{error:"Unable to load body metrics."}:{metrics:data||[]},error?500:200,headers);}
      if(!await canWrite())return json(needEntitlement(),402,headers);const b=obj(await body());
      if(![b.weight_kg,b.height_cm,b.waist_cm].some(x=>x!==undefined)||b.weight_kg!==undefined&&!validNum(b.weight_kg,1,500)||b.height_cm!==undefined&&!validNum(b.height_cm,30,260)||b.waist_cm!==undefined&&!validNum(b.waist_cm,20,250)||(b.measured_at!==undefined&&!validDate(b.measured_at)))return failRequest("Metric values are invalid.",400);
      const {data,error}=await db.from("body_metrics").insert({user_id:uid,...b}).select("id,weight_kg,height_cm,waist_cm,measured_at").single();return json(error?{error:"Unable to save measurement."}:{metric:data},error?500:201,headers);
    }
    if(endpoint==="sleep"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);const b=obj(await body());
      if(!validDate(b.bedtime)||!validDate(b.wake_time)||Date.parse(b.wake_time)<=Date.parse(b.bedtime)||Date.parse(b.wake_time)-Date.parse(b.bedtime)>86400000||!Number.isInteger(b.quality)||b.quality<1||b.quality>5)return failRequest("Sleep times are invalid. Wake time must follow bedtime within 24 hours.",400);
      const {data,error}=await db.from("sleep_logs").insert({user_id:uid,...b}).select("id").single();if(error)return failRequest("Unable to save sleep log.",500);if(admin)await award(admin,uid,3,"sleep_logged",data.id,1);return json({id:data.id,saved:true},200,headers);
    }
    if(endpoint==="workouts"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);const b=obj(await body());
      if(typeof b.title!=="string"||!b.title.trim()||b.title.length>100||typeof b.workout_type!=="string"||b.workout_type.length>40||!Number.isInteger(b.duration_seconds)||b.duration_seconds<1||b.duration_seconds>86400||(b.notes!==undefined&&(typeof b.notes!=="string"||b.notes.length>1000))||!Array.isArray(b.sets)||b.sets.length>100||!b.sets.every((x:any)=>typeof x.exercise_name==="string"&&x.exercise_name.trim().length>0&&x.exercise_name.length<=100&&Number.isInteger(x.set_number)&&x.set_number>=1&&x.set_number<=50&&(x.reps===undefined||Number.isInteger(x.reps)&&x.reps>=0&&x.reps<=1000)&&(x.duration_seconds===undefined||Number.isInteger(x.duration_seconds)&&x.duration_seconds>=0&&x.duration_seconds<=86400)&&(x.weight_kg===undefined||validNum(x.weight_kg,0,1000))))return failRequest("Workout details are invalid.",400);
      const {data:w,error}=await db.from("workouts").insert({user_id:uid,title:b.title,workout_type:b.workout_type,duration_seconds:b.duration_seconds,notes:b.notes}).select("id").single();if(error||!w)return failRequest("Unable to save workout.",500);
      if(b.sets.length){const {error:e}=await db.from("workout_sets").insert(b.sets.map((s:any)=>({...s,user_id:uid,workout_id:w.id})));if(e){await db.from("workouts").delete().eq("id",w.id).eq("user_id",uid);return failRequest("Unable to save workout sets.",500);}}
      if(admin)await award(admin,uid,10,"workout_completed",w.id,1);return json({id:w.id,saved:true},200,headers);
    }
    if(endpoint==="reminders"&&(method==="GET"||method==="PUT")){
      if(method==="GET"){const {data,error}=await db.from("reminders").select("id,kind,local_time,timezone,enabled,quiet_hours").eq("user_id",uid).order("kind");return json(error?{error:"Unable to load reminders."}:{reminders:data||[]},error?500:200,headers);}
      if(!await canWrite())return json(needEntitlement(),402,headers);const b=await body();if(!Array.isArray(b)||b.length>30)return failRequest("Reminder settings are invalid.",400);
      if(!b.every((v:any)=>v&&typeof v.kind==="string"&&v.kind.trim().length>0&&v.kind.length<=40&&(v.local_time===null||validClock(v.local_time))&&typeof v.timezone==="string"&&v.timezone.length>0&&v.timezone.length<=80&&typeof v.enabled==="boolean"&&(v.quiet_hours===undefined||v.quiet_hours&&typeof v.quiet_hours.enabled==="boolean"&&validClock(v.quiet_hours.start)&&validClock(v.quiet_hours.end))))return failRequest("Reminder settings are invalid.",400);const rows=b.map((v:any)=>({...v,user_id:uid}));const {data,error}=await db.from("reminders").upsert(rows,{onConflict:"user_id,kind"}).select("id,kind,local_time,timezone,enabled,quiet_hours");return json(error?{error:"Unable to save reminder preferences."}:{reminders:data||[]},error?500:200,headers);
    }
    if(endpoint==="profile"&&(method==="GET"||method==="PATCH")){
      if(method==="GET"){const {data,error}=await db.from("profiles").select("*").eq("id",uid).single();return json(error?{error:"Profile is not available yet."}:{profile:data},error?503:200,headers);}
      if(!await canWrite())return json(needEntitlement(),402,headers);const b=obj(await body());const allowed=["display_name","birth_date","sex","height_cm","current_weight_kg","goal_weight_kg","activity_level","wellness_goal","dietary_preferences","timezone"];if(Object.keys(b).some(k=>!allowed.includes(k))||!Object.keys(b).length)return failRequest("Profile details are invalid.",400);
      const {data,error}=await db.from("profiles").update(b).eq("id",uid).select("*").single();return json(error?{error:"Unable to update profile."}:{profile:data},error?500:200,headers);
    }
    if(endpoint==="exercises"&&method==="GET"){const {data,error}=await db.from("exercises").select("id,name,category,instructions,difficulty").order("category").order("name");return json(error?{error:"Exercise library is unavailable."}:{exercises:data||[]},error?503:200,headers);}
    if(endpoint==="points"&&method==="GET"){
      const [{data:total,error:e1},{data:recent,error:e2}]=await Promise.all([db.rpc("get_my_points"),db.from("points_ledger").select("id,points,reason,created_at").eq("user_id",uid).order("created_at",{ascending:false}).limit(20)]);
      if(e1||e2)return failRequest("Unable to load your points.",503);const points=Number(total)||0;return json({total:points,level:Math.floor(points/100)+1,level_progress:points%100,next_level_at:(Math.floor(points/100)+1)*100,recent:recent||[]},200,headers);
    }
    if(endpoint==="progress"&&method==="GET"){
      const since=new Date(Date.now()-30*86400000).toISOString();const [metrics,workouts,meals,habits,sleep,badges,points]=await Promise.all([
        db.from("body_metrics").select("weight_kg,measured_at").eq("user_id",uid).gte("measured_at",since).order("measured_at"),
        db.from("workouts").select("duration_seconds,started_at").eq("user_id",uid).gte("started_at",since),
        db.from("meals").select("calories,logged_at").eq("user_id",uid).gte("logged_at",since),
        db.from("habit_logs").select("completed_at").eq("user_id",uid).gte("completed_at",since),
        db.from("sleep_logs").select("bedtime,wake_time,quality").eq("user_id",uid).gte("bedtime",since),
        db.from("badges").select("id",{count:"exact",head:true}).eq("user_id",uid),db.rpc("get_my_points")]);
      if([metrics,workouts,meals,habits,sleep,badges,points].some(x=>x.error))return failRequest("Unable to calculate progress right now.",503);
      const days=new Map<string,number>();for(const row of meals.data||[]){const day=row.logged_at.slice(0,10);days.set(day,(days.get(day)||0)+Number(row.calories||0));}
      const hours=(sleep.data||[]).map(x=>(Date.parse(x.wake_time)-Date.parse(x.bedtime))/3600000).filter(x=>x>0&&x<=24);
      return json({points:Number(points.data)||0,badges:badges.count||0,weight:metrics.data||[],workouts:{sessions:workouts.data?.length||0,minutes:Math.round((workouts.data||[]).reduce((s,x)=>s+Number(x.duration_seconds||0)/60,0))},meals:{entries:meals.data?.length||0,daily_calories:[...days].map(([date,calories])=>({date,calories}))},habits:{checkins:habits.data?.length||0},sleep:{entries:hours.length,average_hours:hours.length?Number((hours.reduce((a,b)=>a+b,0)/hours.length).toFixed(1)):null,average_quality:sleep.data?.length?Number((sleep.data.reduce((a,x)=>a+Number(x.quality||0),0)/sleep.data.length).toFixed(1)):null}},200,headers);
    }
    if(endpoint==="notifications"&&(method==="GET"||method==="POST")){
      if(method==="GET"){const {data,error}=await db.from("notifications").select("id,title,body,delivery_status,created_at,delivered_at,read_at").eq("user_id",uid).order("created_at",{ascending:false}).limit(50);return json(error?{error:"Unable to load notifications."}:{notifications:data||[]},error?500:200,headers);}
      const b=obj(await body());if(typeof b.id!=="string")return failRequest("Notification ID is invalid.",400);const {data,error}=await db.rpc("mark_my_notification_read",{p_notification_id:b.id});return json(error?{error:"Unable to mark notification as read."}:{read:data===true},error?500:200,headers);
    }
    if(endpoint==="meals/save"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);
      const form=await req.formData(),raw=form.get("meal");
      if(typeof raw!=="string")return failRequest("Meal details are missing.",400);
      let parsed:any;try{parsed=JSON.parse(raw);}catch{return failRequest("Meal details are invalid.",400);}
      if(!Array.isArray(parsed.foods)||!parsed.foods.length||parsed.foods.length>15||!["breakfast","lunch","dinner","snack"].includes(parsed.meal_type)||!Number.isInteger(parsed.meal_score)||parsed.meal_score<0||parsed.meal_score>100||!parsed.foods.every(validMealItem))return failRequest("Meal details are invalid.",400);
      const image=form.get("image");let photo_path:string|null=null;
      if(image instanceof File){
        if(!["image/jpeg","image/png","image/webp"].includes(image.type)||image.size>8*1024*1024)return failRequest("Photo must be JPG, PNG or WebP and smaller than 8 MB.",400);
        const ext=image.type==="image/jpeg"?"jpg":image.type.split("/")[1];photo_path=uid+"/"+crypto.randomUUID()+"."+ext;
        const {error}=await db.storage.from("meal-photos").upload(photo_path,image,{contentType:image.type,upsert:false});if(error)return failRequest("Unable to securely upload the meal photo.",503);
      }
      const totals=parsed.foods.reduce((a:any,x:any)=>({calories:a.calories+Number(x.nutrition?.calories||0),protein_g:a.protein_g+Number(x.nutrition?.protein_g||0),carbs_g:a.carbs_g+Number(x.nutrition?.carbs_g||0),fat_g:a.fat_g+Number(x.nutrition?.fat_g||0),fiber_g:a.fiber_g+Number(x.nutrition?.fiber_g||0)}),{calories:0,protein_g:0,carbs_g:0,fat_g:0,fiber_g:0});
      const {data:meal,error}=await db.from("meals").insert({user_id:uid,meal_type:parsed.meal_type,meal_score:parsed.meal_score,photo_path,...totals,ai_estimate:true}).select("id").single();
      if(error||!meal){if(photo_path)await db.storage.from("meal-photos").remove([photo_path]);return failRequest("Unable to save this meal.",500);}
      const {error:itemError}=await db.from("meal_items").insert(parsed.foods.map((x:any)=>({meal_id:meal.id,user_id:uid,name:x.name,portion_grams:x.portion_grams,confidence:x.confidence??null,nutrition:x.nutrition})));
      if(itemError){await db.from("meals").delete().eq("id",meal.id).eq("user_id",uid);if(photo_path)await db.storage.from("meal-photos").remove([photo_path]);return failRequest("Unable to save meal items.",500);}
      if(admin)await award(admin,uid,5,"meal_logged",meal.id,3);return json({id:meal.id,saved:true},200,headers);
    }
    if(endpoint==="meals"&&(method==="GET"||method==="POST")){
      if(method==="GET"){let q=db.from("meals").select("id,meal_type,photo_path,calories,protein_g,carbs_g,fat_g,fiber_g,meal_score,ai_estimate,logged_at,meal_items(id,name,portion_grams,confidence,nutrition)").eq("user_id",uid).order("logged_at",{ascending:false}).limit(100);q=readRange(q);const {data,error}=await q;if(error)return failRequest("Unable to load meals.",500);const meals=await Promise.all((data||[]).map(async m=>{if(!m.photo_path)return {...m,photo_url:null};const {data:s}=await db.storage.from("meal-photos").createSignedUrl(m.photo_path,300);return {...m,photo_url:s?.signedUrl||null};}));return json({meals},200,headers);}
      if(!await canWrite())return json(needEntitlement(),402,headers);const b=obj(await body());if(!validMealType(b.meal_type)||(b.logged_at!==undefined&&!validDate(b.logged_at))||(b.meal_score!==undefined&&(!Number.isInteger(b.meal_score)||b.meal_score<0||b.meal_score>100))||(b.photo_base64!==undefined&&(typeof b.photo_base64!=="string"||b.photo_base64.length>11500000))||!Array.isArray(b.items)||b.items.length<1||b.items.length>15||!b.items.every(validMealItem))return failRequest("Meal details are invalid.",400);
      const totals=b.items.reduce((a:any,x:any)=>({calories:a.calories+Number(x.nutrition?.calories||0),protein_g:a.protein_g+Number(x.nutrition?.protein_g||0),carbs_g:a.carbs_g+Number(x.nutrition?.carbs_g||0),fat_g:a.fat_g+Number(x.nutrition?.fat_g||0),fiber_g:a.fiber_g+Number(x.nutrition?.fiber_g||0)}),{calories:0,protein_g:0,carbs_g:0,fat_g:0,fiber_g:0});
      let photo_path:string|null=null;
      if(b.photo_base64){const m=String(b.photo_base64).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!m)return failRequest("Meal photo encoding is invalid.",400);const bytes=dec(m[2]);if(bytes.length>8*1024*1024)return failRequest("Meal photo must be smaller than 8 MB.",413);const ext=m[1]==="image/jpeg"?"jpg":m[1].split("/")[1];photo_path=uid+"/"+crypto.randomUUID()+"."+ext;const {error}=await db.storage.from("meal-photos").upload(photo_path,bytes,{contentType:m[1],upsert:false});if(error)return failRequest("Unable to securely store meal photo.",500);}
      const {data:meal,error}=await db.from("meals").insert({user_id:uid,meal_type:b.meal_type,logged_at:b.logged_at,meal_score:b.meal_score,photo_path,...totals,ai_estimate:true}).select("id").single();
      if(error||!meal){if(photo_path)await db.storage.from("meal-photos").remove([photo_path]);return failRequest("Unable to save meal.",500);}
      const {error:itemError}=await db.from("meal_items").insert(b.items.map((x:any)=>({meal_id:meal.id,user_id:uid,name:x.name,portion_grams:x.portion_grams,confidence:x.confidence??null,nutrition:x.nutrition})));
      if(itemError){await db.from("meals").delete().eq("id",meal.id).eq("user_id",uid);if(photo_path)await db.storage.from("meal-photos").remove([photo_path]);return failRequest("Unable to save meal items.",500);}
      if(admin)await award(admin,uid,5,"meal_logged",meal.id,3);return json({id:meal.id,saved:true,totals},201,headers);
    }
    if(endpoint==="meals/analyze"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);const form=await req.formData(),image=form.get("image");if(!(image instanceof File))return failRequest("Choose a meal photo first.",400);
      if(!["image/jpeg","image/png","image/webp"].includes(image.type))return failRequest("Use a JPG, PNG or WebP image.",415);if(image.size>8*1024*1024)return failRequest("Image must be smaller than 8 MB.",413);
      const key=Deno.env.get("OPENAI_API_KEY");if(!key)return failRequest("Meal analysis is not configured yet.",503);
      const {data:allowed,error}=await db.rpc("consume_ai_request",{p_endpoint:"meal_analysis",p_hourly_limit:10});if(error)return failRequest("Meal scanner is not configured.",503);if(allowed!==true)return failRequest("You have reached the meal scanner limit of 10 analyses per hour.",429);
      const dataUrl="data:"+image.type+";base64,"+enc(new Uint8Array(await image.arrayBuffer()));
      const schema={type:"object",additionalProperties:false,properties:{foods:{type:"array",items:{type:"object",additionalProperties:false,properties:{name:{type:"string"},category:{type:"string"},portion_grams:{type:"number"},confidence:{type:"number"},nutrition:{type:"object",additionalProperties:false,properties:{calories:{type:"number"},protein_g:{type:"number"},carbs_g:{type:"number"},fat_g:{type:"number"},fiber_g:{type:"number"},sugar_g:{type:"number"},sodium_mg:{type:"number"}},required:["calories","protein_g","carbs_g","fat_g","fiber_g","sugar_g","sodium_mg"]}},required:["name","category","portion_grams","confidence","nutrition"]}},benefits:{type:"array",items:{type:"string"}},risks:{type:"array",items:{type:"string"}},meal_score:{type:"integer"},score_reason:{type:"string"}},required:["foods","benefits","risks","meal_score","score_reason"]};
      const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:Deno.env.get("OPENAI_VISION_MODEL")||"gpt-4o-mini",temperature:0.2,response_format:{type:"json_schema",json_schema:{name:"meal_analysis",strict:true,schema}},messages:[{role:"system",content:"Estimate nutrition from meal photos. Values are estimates, not medical advice. Never claim certainty. If not clearly food, return empty foods."},{role:"user",content:[{type:"text",text:"Identify foods and estimate edible portions and nutrition."},{type:"image_url",image_url:{url:dataUrl,detail:"high"}}]}]})});
      if(!r.ok)return failRequest("The meal scanner is temporarily unavailable.",502);const result=obj((await r.json()).choices?.[0]?.message);let analysis:any;try{analysis=JSON.parse(result.content);}catch{return failRequest("The scanner returned no usable analysis.",502);}if(!Array.isArray(analysis.foods)||!analysis.foods.length||analysis.foods.length>15||!analysis.foods.every(validMealItem)||!Array.isArray(analysis.benefits)||analysis.benefits.length>8||!Array.isArray(analysis.risks)||analysis.risks.length>8||!Number.isInteger(analysis.meal_score)||analysis.meal_score<0||analysis.meal_score>100||typeof analysis.score_reason!=="string")return failRequest("We couldn't confidently validate the meal estimate. Try a clearer photo.",422);
      return json({analysis,disclaimer:"AI-generated nutrition estimates can be inaccurate and are not medical advice."},200,headers);
    }
    if(endpoint==="friends"&&method==="GET"){const {data,error}=await db.rpc("get_friends_zone");return json(error?{error:"Unable to load friends."}:{friends:data||[]},error?503:200,headers);}
    if(endpoint==="friends/invite"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);const bytes=crypto.getRandomValues(new Uint8Array(32));const token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token)));const token_hash=[...hash].map(x=>x.toString(16).padStart(2,"0")).join("");
      const {error}=await db.from("friend_invites").insert({inviter_id:uid,token_hash,expires_at:new Date(Date.now()+7*86400000).toISOString()});if(error)return failRequest("Could not create an invite.",503);return json({invite_url:SITE_URL+SITE_BASE_PATH+"/friends/accept/?token="+encodeURIComponent(token),expires_in_days:7},200,headers);
    }
    if(endpoint==="friends/accept"&&method==="POST"){
      if(!await canWrite())return json(needEntitlement(),402,headers);const b=obj(await body());if(typeof b.token!=="string"||b.token.length<32||b.token.length>100)return failRequest("Invitation link is invalid.",400);
      const hash=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(b.token)));const token_hash=[...hash].map(x=>x.toString(16).padStart(2,"0")).join("");const {data,error}=await db.rpc("accept_friend_invite",{p_token:b.token});
      if(error)return failRequest("Unable to accept invitation.",400);if(data!==true)return failRequest("This invitation has expired or was already used.",410);return json({accepted:true},200,headers);
    }
    if(endpoint==="push/subscriptions"&&(method==="POST"||method==="DELETE")){
      const b=obj(await body());if(!validPushEndpoint(b.endpoint))return failRequest("Push endpoint must use a supported browser push service over HTTPS.",400);
      if(method==="POST"){if(!obj(b.keys).p256dh||!obj(b.keys).auth)return failRequest("Push subscription details are invalid.",400);const {error}=await db.from("push_subscriptions").upsert({user_id:uid,endpoint:b.endpoint,subscription:b},{onConflict:"endpoint"});return json(error?{error:"Unable to save this device subscription."}:{saved:true},error?409:201,headers);}
      const {error}=await db.from("push_subscriptions").delete().eq("user_id",uid).eq("endpoint",b.endpoint);return json(error?{error:"Unable to remove this device."}:{removed:true},error?500:200,headers);
    }
    if(endpoint==="billing/status"&&method==="GET"){
      const {data,error}=await db.from("subscriptions").select("status,trial_ends_at,current_period_end,provider").eq("user_id",uid).maybeSingle();if(error)return failRequest("Unable to read subscription status.",500);if(!data)return json({status:"not_initialized",active:false,checkout_configured:!!(Deno.env.get("STRIPE_SECRET_KEY")&&Deno.env.get("STRIPE_PRICE_ID"))},200,headers);
      const now=Date.now(),te=Date.parse(data.trial_ends_at||"")||0,pe=Date.parse(data.current_period_end||"")||0,trial=data.status==="trialing"&&te>now,paid=["active","past_due"].includes(data.status)&&pe>now;
      return json({status:data.status,trial_ends_at:data.trial_ends_at,current_period_end:data.current_period_end,active:trial||paid,trial_days_remaining:trial?Math.ceil((te-now)/86400000):0,checkout_configured:!!(Deno.env.get("STRIPE_SECRET_KEY")&&Deno.env.get("STRIPE_PRICE_ID"))},200,headers);
    }
    if((endpoint==="billing/checkout"||endpoint==="billing/portal")&&method==="POST"){
      const secret=Deno.env.get("STRIPE_SECRET_KEY"),price=Deno.env.get("STRIPE_PRICE_ID");if(!secret)return failRequest("Secure billing is not configured.",503);
      const {data:sub,error}=await db.from("subscriptions").select("status,trial_ends_at,current_period_end,provider_customer_id").eq("user_id",uid).maybeSingle();if(error||!sub)return failRequest("Subscription record is unavailable.",503);
      if(endpoint.endsWith("checkout")){
        if(!price)return failRequest("Secure checkout is not configured.",503);if(sub.status==="trialing"&&Date.parse(sub.trial_ends_at||"")>Date.now())return failRequest("Your free trial is still active.",409);if(["active","past_due"].includes(sub.status))return failRequest("You already have a subscription.",409);
        const form=new URLSearchParams({mode:"subscription","line_items[0][price]":price,"line_items[0][quantity]":"1",success_url:SITE_URL+SITE_BASE_PATH+"/subscribe/?checkout=success",cancel_url:SITE_URL+SITE_BASE_PATH+"/subscribe/?checkout=cancelled",client_reference_id:uid,"metadata[user_id]":uid,"subscription_data[metadata][user_id]":uid});
        if(sub.provider_customer_id)form.set("customer",sub.provider_customer_id);else if(user!.email)form.set("customer_email",user!.email);
        const r=await stripeRequest("checkout/sessions",secret,form);const p=obj(await r.json());return json(r.ok&&p.url?{url:p.url}:{error:"Unable to start secure checkout."},r.ok?200:502,headers);
      }
      if(!sub.provider_customer_id)return failRequest("No Stripe customer is linked to this account yet.",404);const form=new URLSearchParams({customer:sub.provider_customer_id,return_url:SITE_URL+SITE_BASE_PATH+"/subscribe/"});const r=await stripeRequest("billing_portal/sessions",secret,form);const p=obj(await r.json());return json(r.ok&&p.url?{url:p.url}:{error:"Unable to open the billing portal."},r.ok?200:502,headers);
    }
    if(endpoint==="account/export"&&method==="GET"){
      const tables=["profiles","water_logs","habits","habit_logs","workouts","workout_sets","sleep_logs","body_metrics","meals","meal_items","reminders","notifications","points_ledger","badges"];const result:Record<string,unknown>={exported_at:new Date().toISOString(),user_id:uid};
      for(const table of tables){const column=table==="profiles"?"id":"user_id";const {data,error}=await db.from(table).select("*").eq(column,uid);if(error)return failRequest("Unable to export account data.",500);result[table]=data||[];}
      return json(result,200,{...headers,"Content-Disposition":"attachment; filename=luminaf-export.json"});
    }
    if(endpoint==="account/delete"&&method==="POST"){
      const b=obj(await body());if(b.confirmation!=="DELETE")return failRequest("Type DELETE to confirm permanent account deletion.",400);if(!admin)return failRequest("Secure account deletion is not configured.",503);
      const {data:sub,error:se}=await admin.from("subscriptions").select("provider_subscription_id,status").eq("user_id",uid).maybeSingle();if(se)return failRequest("Could not verify billing status. Account was not deleted.",503);
      if(sub?.provider_subscription_id&&!["canceled","incomplete_expired"].includes(sub.status)){const sk=Deno.env.get("STRIPE_SECRET_KEY");if(!sk)return failRequest("An active Stripe subscription is linked to this account, but cancellation is not configured.",503);const r=await fetch("https://api.stripe.com/v1/subscriptions/"+encodeURIComponent(sub.provider_subscription_id),{method:"DELETE",headers:{Authorization:"Bearer "+sk}});if(!r.ok)return failRequest("Stripe could not confirm cancellation. Account was not deleted.",502);}
      for(let i=0;i<100;i++){const {data:items,error}=await admin.storage.from("meal-photos").list(uid,{limit:1000,offset:0});if(error)return failRequest("Could not prepare private photo deletion.",500);if(!items?.length)break;const {error:e}=await admin.storage.from("meal-photos").remove(items.filter(x=>x.name).map(x=>uid+"/"+x.name));if(e)return failRequest("Could not remove private photos.",500);}
      const {error}=await admin.auth.admin.deleteUser(uid);if(error)return failRequest("Account deletion failed.",500);return json({deleted:true},200,headers);
    }
    return failRequest("This API operation has not been migrated yet: "+method+" /"+endpoint,501);
  } catch (e) {
    console.error("api-gateway error",e);
    return json({error:"The request could not be completed."},500,headers);
  }
});
