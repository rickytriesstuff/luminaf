import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
const querySchema=z.object({lat:z.coerce.number().min(-90).max(90),lon:z.coerce.number().min(-180).max(180)});
function condition(code:number){if(code===0)return "Clear";if([1,2].includes(code))return "Mostly clear";if(code===3)return "Overcast";if([45,48].includes(code))return "Fog";if([51,53,55,56,57].includes(code))return "Drizzle";if([61,63,65,66,67,80,81,82].includes(code))return "Rain";if([71,73,75,77,85,86].includes(code))return "Snow";if([95,96,99].includes(code))return "Thunderstorm";return "Variable conditions";}
export async function GET(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in to check local weather."},{status:401});
 const url=new URL(request.url),lat=url.searchParams.get("lat"),lon=url.searchParams.get("lon");
 if(lat===null||lon===null)return NextResponse.json({error:"Location coordinates are required."},{status:400});
 const parsed=querySchema.safeParse({lat,lon});
 if(!parsed.success)return NextResponse.json({error:"Valid latitude and longitude are required."},{status:400});
 try{
  const params=new URLSearchParams({latitude:String(parsed.data.lat),longitude:String(parsed.data.lon),current:"temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",timezone:"auto"});
  const response=await fetch("https://api.open-meteo.com/v1/forecast?"+params.toString(),{cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!response.ok)return NextResponse.json({error:"Weather service is temporarily unavailable."},{status:502,headers:{"Cache-Control":"no-store"}});
  const payload=await response.json();
  const current=payload.current;
  if(!current)return NextResponse.json({error:"Weather data is unavailable for this location."},{status:502,headers:{"Cache-Control":"no-store"}});
  const code=Number(current.weather_code),precipitation=Number(current.precipitation)||0,temperature=Number(current.temperature_2m),wind=Number(current.wind_speed_10m)||0;
  return NextResponse.json({temperature_c:current.temperature_2m,feels_like_c:current.apparent_temperature,precipitation_mm:precipitation,wind_kmh:current.wind_speed_10m,weather_code:code,condition:condition(code),suggestion:precipitation>0||wind>40||temperature>35||temperature<0||[45,48,61,63,65,66,67,71,73,75,80,81,82,85,86,95,96,99].includes(code)?"An indoor session may be more comfortable right now.":"Conditions may suit a comfortable outdoor session. Check local conditions before heading out.",timezone:payload.timezone},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Unable to retrieve weather right now."},{status:502,headers:{"Cache-Control":"no-store"}});}
}
