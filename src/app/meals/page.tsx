"use client";
import {useState} from "react";
import {ArrowLeft,BookOpen,CheckCircle2,Save,Utensils} from "lucide-react";

const initial={name:"",portion:"100",calories:"",protein:"",carbs:"",fat:"",fiber:"",sugar:"",sodium:""};
export default function MealsPage(){
 const [form,setForm]=useState(initial);
 const [mealType,setMealType]=useState("lunch");
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState("");
 const [error,setError]=useState("");
 function update(key:keyof typeof initial,value:string){setForm(v=>({...v,[key]:value}));}
 async function save(){
  setBusy(true);setMessage("");setError("");
  try{
   if(!form.name.trim())throw new Error("Enter the name of your food.");
   const number=(value:string)=>Number(value||0);
   const portion=number(form.portion);
   if(!Number.isFinite(portion)||portion<1||portion>3000)throw new Error("Portion must be between 1 and 3,000 grams.");
   const nutrition={calories:number(form.calories),protein_g:number(form.protein),carbs_g:number(form.carbs),fat_g:number(form.fat),fiber_g:number(form.fiber),sugar_g:number(form.sugar),sodium_mg:number(form.sodium)};
   if(Object.values(nutrition).some(v=>!Number.isFinite(v)||v<0))throw new Error("Nutrition values must be zero or greater.");
   const response=await fetch("/api/meals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({meal_type:mealType,items:[{name:form.name.trim(),portion_grams:portion,confidence:1,nutrition}]})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||"Unable to save this meal.");
   setMessage("Meal saved to your private food journal. Your nutrition dashboard will update.");
   setForm(initial);
  }catch(e){setError(e instanceof Error?e.message:"Unable to save this meal.");}
  finally{setBusy(false);}
 }
 const fields:[keyof typeof initial,string,string,number][]=[
  ["portion","Portion size","g",3000],["calories","Calories","kcal",5000],["protein","Protein","g",300],["carbs","Carbohydrates","g",500],["fat","Fat","g",300],["fiber","Fibre","g",150],["sugar","Sugar","g",250],["sodium","Sodium","mg",15000]
 ];
 return <main className="mx-auto min-h-screen max-w-3xl px-5 py-8 pb-16">
  <a href="/" className="flex items-center gap-2 text-sm text-[#8CFFC9]"><ArrowLeft size={16}/> Dashboard</a>
  <p className="mt-10 text-xs tracking-[.2em] text-[#8CFFC9]">NUTRITION JOURNAL</p>
  <h1 className="mt-2 text-3xl font-semibold">Log a meal</h1>
  <p className="mt-2 text-sm leading-relaxed text-[#91A49A]">Add food and its nutrition information manually. Your saved entries feed the Nutrition Overview and Progress charts. AI photo scanning will be added in a later release.</p>
  <section className="panel mt-7 rounded-3xl p-5 sm:p-6">
   <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#10251B] text-[#8CFFC9]"><Utensils/></span><div><h2 className="font-semibold">Food details</h2><p className="text-xs text-[#71847A]">Enter one food item per entry</p></div></div>
   <label className="mt-5 block text-xs text-[#91A49A]">Food name<input value={form.name} onChange={e=>update("name",e.target.value)} maxLength={100} placeholder="e.g. Rice and beans" className="mt-2 w-full rounded-xl border border-[#26372E] bg-[#070B09] p-3 text-sm text-white"/></label>
   <label className="mt-4 block text-xs text-[#91A49A]">Meal type<select value={mealType} onChange={e=>setMealType(e.target.value)} className="mt-2 w-full rounded-xl border border-[#26372E] bg-[#070B09] p-3 text-sm text-white"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label>
   <h3 className="mt-6 text-sm font-semibold">Nutrition information</h3>
   <p className="mt-1 text-xs text-[#71847A]">Use the values for the portion you entered. Unknown values can be left at zero.</p>
   <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{fields.map(([key,label,unit,max])=><label key={key} className="text-xs text-[#91A49A]">{label}<div className="mt-2 flex items-center rounded-xl border border-[#26372E] bg-[#070B09] pr-3"><input type="number" min="0" max={max} step="any" value={form[key]} onChange={e=>update(key,e.target.value)} placeholder="0" className="min-w-0 w-full bg-transparent p-3 text-sm text-white outline-none"/><span className="text-[10px] text-[#71847A]">{unit}</span></div></label>)}</div>
   {error&&<p role="alert" className="mt-4 rounded-xl border border-red-900/70 bg-red-950/30 p-3 text-xs text-red-200">{error}</p>}
   {message&&<p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-[#31513F] bg-[#0C1711] p-3 text-xs text-[#B7F9D5]"><CheckCircle2 size={16} className="shrink-0"/>{message}</p>}
   <button disabled={busy||!form.name.trim()} onClick={()=>void save()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00E58A] p-3 text-sm font-bold text-[#03120B] disabled:opacity-40"><Save size={16}/>{busy?"Saving meal…":"Save meal"}</button>
  </section>
  <section className="mt-5 flex items-start gap-3 rounded-2xl border border-[#26372E] bg-[#0A100D] p-4 text-xs leading-relaxed text-[#91A49A]"><BookOpen size={17} className="shrink-0 text-[#8CFFC9]"/> Nutrition values are only as accurate as the information entered. Check food labels and portion sizes, and verify allergens independently. This tool is not medical advice.</section>
  <a href="/nutrition" className="mt-5 inline-flex items-center gap-2 text-sm text-[#8CFFC9]">View nutrition overview <span aria-hidden="true">→</span></a>
 </main>;
}
