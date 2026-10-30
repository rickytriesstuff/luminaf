import {describe,expect,it} from "vitest";
import {calculateBmi,calculateBmr} from "./calculations";
describe("health calculations",()=>{it("calculates BMI to one decimal place",()=>expect(calculateBmi(70,175)).toBe(22.9));it("calculates Mifflin-St Jeor BMR",()=>expect(calculateBmr(70,175,30,"male")).toBe(1649));it("rejects invalid measurements",()=>expect(()=>calculateBmi(0,170)).toThrow());});