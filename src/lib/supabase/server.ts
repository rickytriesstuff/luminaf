import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
export async function createClient(){
 const store=cookies();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)throw new Error("Supabase environment variables are not configured.");
 return createServerClient(url,key,{cookies:{
  getAll(){return store.getAll();},
  setAll(cookiesToSet:{name:string;value:string;options?:Parameters<typeof store.set>[2]}[]){
   try{cookiesToSet.forEach(({name,value,options})=>store.set(name,value,options));}
   catch{/* Server components cannot write response cookies. Middleware refreshes sessions. */}
  }
 }});
}
