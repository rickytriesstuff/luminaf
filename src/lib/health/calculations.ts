export type Sex="female"|"male";
export function calculateBmi(weightKg:number,heightCm:number):number{if(weightKg<=0||heightCm<=0)throw new Error("Weight and height must be positive.");const m=heightCm/100;return Math.round(weightKg/(m*m)*10)/10;}
/** Mifflin-St Jeor estimate, not clinical nutrition advice. */
export function calculateBmr(weightKg:number,heightCm:number,age:number,sex:Sex):number{if(weightKg<=0||heightCm<=0||age<13||age>120)throw new Error("Invalid profile values.");return Math.round(10*weightKg+6.25*heightCm-5*age+(sex==="male"?5:-161));}