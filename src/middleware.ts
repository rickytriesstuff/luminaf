import {createServerClient} from "@supabase/ssr";
import {NextResponse,type NextRequest} from "next/server";
export async function middleware(request:NextRequest){
 let response=NextResponse.next({request});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return response;
 const supabase=createServerClient(url,key,{cookies:{
  getAll:()=>request.cookies.getAll(),
  setAll(cookiesToSet:{name:string;value:string;options?:Parameters<typeof response.cookies.set>[2]}[]){
   cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
   response=NextResponse.next({request});
   cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
  }
 }});
 const {data:{user}}=await supabase.auth.getUser();
 if(!user&&request.nextUrl.pathname.startsWith("/onboarding")){
  const target=request.nextUrl.clone();target.pathname="/auth";return NextResponse.redirect(target);
 }
 if(user&&request.nextUrl.pathname==="/auth"){
  const target=request.nextUrl.clone();target.pathname="/onboarding";return NextResponse.redirect(target);
 }
 return response;
}
export const config={matcher:["/auth","/onboarding/:path*"]};
