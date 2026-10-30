import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";\nimport {hasActiveEntitlement,entitlementRequiredResponse} from "@/lib/billing/entitlement";
const itemSchema=z.object({name:z.string().trim().min(1).max(100),portion_grams:z.number().min(1).max(3000),confidence:z.number().min(0).max(1).optional(),nutrition:z.object({calories:z.number().min(0).max(5000),protein_g:z.number().min(0).max(300),carbs_g:z.number().min(0).max(500),fat_g:z.number().min(0).max(300),fiber_g:z.number().min(0).max(150),sugar_g:z.number().min(0).max(250),sodium_mg:z.number().min(0).max(15000)}).strict()});
const schema=z.object({meal_type:z.enum(["breakfast","lunch","dinner","snack"]).optional(),logged_at:z.string().datetime().optional(),meal_score:z.number().int().min(0).max(100).optional(),photo_base64:z.string().max(11_500_000).optional(),items:z.array(itemSchema).min(1).max(15)});
export async function GET(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
 const url=new URL(request.url),from=url.searchParams.get("from"),to=url.searchParams.get("to");
 let query=supabase.from("meals").select("id,meal_type,photo_path,calories,protein_g,carbs_g,fat_g,fiber_g,meal_score,ai_estimate,logged_at,meal_items(id,name,portion_grams,confidence,nutrition)").eq("user_id",user.id).order("logged_at",{ascending:false}).limit(100);
 if(from)query=query.gte("logged_at",from);
 if(to)query=query.lte("logged_at",to);
 const {data,error}=await query;
 if(error)return NextResponse.json({error:"Unable to load meals."},{status:500});
 return NextResponse.json({meals:data??[]});
}
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in required."},{status:401});\n if(!await hasActiveEntitlement(supabase,user.id))return NextResponse.json(entitlementRequiredResponse(),{status:402});
 const parsed=schema.safeParse(await request.json());
 if(!parsed.success)return NextResponse.json({error:"Meal details are invalid.",issues:parsed.error.flatten()},{status:400});
 const {items,...input}=parsed.data;
 const totals=items.reduce((a,item)=>({calories:a.calories+item.nutrition.calories,protein_g:a.protein_g+item.nutrition.protein_g,carbs_g:a.carbs_g+item.nutrition.carbs_g,fat_g:a.fat_g+item.nutrition.fat_g,fiber_g:a.fiber_g+item.nutrition.fiber_g}),{calories:0,protein_g:0,carbs_g:0,fat_g:0,fiber_g:0});
 let photo_path:string|null=null;
 if(input.photo_base64){
  const match=input.photo_base64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!match)return NextResponse.json({error:"Meal photo encoding is invalid."},{status:400});
  const bytes=Buffer.from(match[2],"base64");
  if(bytes.length>8*1024*1024)return NextResponse.json({error:"Meal photo must be smaller than 8 MB."},{status:413});
  const ext=match[1]==="image/jpeg"?"jpg":match[1].split("/")[1];
  photo_path=user.id+"/"+crypto.randomUUID()+"."+ext;
  const {error:uploadError}=await supabase.storage.from("meal-photos").upload(photo_path,bytes,{contentType:match[1],upsert:false});
  if(uploadError)return NextResponse.json({error:"Unable to securely store meal photo."},{status:500});
 }
 const {photo_base64:_,...mealInput}=input;
 const {data:meal,error}=await supabase.from("meals").insert({user_id:user.id,meal_type:mealInput.meal_type,logged_at:mealInput.logged_at,meal_score:mealInput.meal_score,photo_path,calories:totals.calories,protein_g:totals.protein_g,carbs_g:totals.carbs_g,fat_g:totals.fat_g,fiber_g:totals.fiber_g,ai_estimate:true}).select("id").single();
 if(error||!meal){if(photo_path)await supabase.storage.from("meal-photos").remove([photo_path]);return NextResponse.json({error:"Unable to save meal."},{status:500});}
 const {error:itemError}=await supabase.from("meal_items").insert(items.map(item=>({meal_id:meal.id,user_id:user.id,name:item.name,portion_grams:item.portion_grams,confidence:item.confidence??null,nutrition:item.nutrition})));
 if(itemError){await supabase.from("meals").delete().eq("id",meal.id).eq("user_id",user.id);if(photo_path)await supabase.storage.from("meal-photos").remove([photo_path]);return NextResponse.json({error:"Unable to save meal items."},{status:500});}
 return NextResponse.json({id:meal.id,saved:true,totals},{status:201});
}
