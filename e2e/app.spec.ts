import {expect,test} from "@playwright/test";
test("dashboard renders core wellness navigation",async({page})=>{
 await page.goto("./");
 await expect(page.getByRole("heading",{name:/your day, in balance/i})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Main navigation"})).toBeVisible();
 await expect(page.getByRole("link",{name:/habit garden/i}).first()).toBeVisible();
 await expect(page.getByRole("link",{name:/nutrition overview/i})).toBeVisible();
});
test("GitHub Pages internal navigation stays inside the project path",async({page})=>{
 await page.goto("./");
 const nutrition=page.getByRole("link",{name:/nutrition overview/i});
 await expect(nutrition).toHaveAttribute("href",/\/luminaf\/nutrition\/$/);
 await nutrition.click();
 await expect(page).toHaveURL(/\/luminaf\/nutrition\/$/);
 await expect(page.getByRole("heading",{name:"Nutrition overview"})).toBeVisible();
 await page.goto("./");
 const profile=page.locator('a[aria-label="Profile and settings"]');
 await expect(profile).toHaveAttribute("href",/luminaf\/profile\/$/);
 await profile.click();
 await expect(page).toHaveURL(/\/luminaf\/profile\/$/);
 await expect(page.getByRole("heading",{name:"Profile"})).toBeVisible();
});
test("subscription and reminder settings pages render",async({page})=>{
 await page.goto("subscribe/");
 await expect(page.getByRole("heading",{name:/More support for your wellness journey/i})).toBeVisible();
 await expect(page.getByRole("button",{name:/Payments setup pending/i})).toBeDisabled();
 await page.goto("reminders/");
 await expect(page.getByRole("heading",{name:/Build a rhythm that supports you/i})).toBeVisible();
 await page.goto("notifications/");
 await expect(page.getByRole("heading",{name:/Notifications are coming later/i})).toBeVisible();
});
test("health check-in keeps its medical disclaimer visible",async({page})=>{
 await page.goto("health/");
 await expect(page.getByRole("heading",{name:"Health check-in"})).toBeVisible();
 await expect(page.getByText(/not medical advice or a diagnosis/i)).toBeVisible();
 await expect(page.getByText(/do not wait for this tool/i)).toBeVisible();
});
test("meal scanner enforces a visible five-scan daily allowance",async({page})=>{
 await page.goto("meals/");
 await expect(page.getByRole("heading",{name:"Meal scanner"})).toBeVisible();
 await expect(page.getByText(/photograph a meal and let ai estimate the foods, portions and nutrition/i)).toBeVisible();
 await expect(page.getByText(/of 5 left today/i)).toBeVisible();
});
test("PWA manifest is served beneath the GitHub Pages base path",async({request})=>{
 const response=await request.get("manifest.webmanifest");
 expect(response.ok()).toBeTruthy();
 const manifest=await response.json();
 expect(manifest.name).toBe("Luminaf");
 expect(manifest.display).toBe("standalone");
});
test("nutrition dashboard renders live-data summaries and charts",async({page})=>{
 await page.goto("nutrition/");
 await expect(page.getByRole("heading",{name:"Nutrition overview"})).toBeVisible();
 await expect(page.getByRole("heading",{name:/Today's nutrition/i})).toBeVisible();
 await expect(page.getByRole("heading",{name:/Last 7 days/i})).toBeVisible();
 await expect(page.getByRole("heading",{name:/macro balance/i})).toBeVisible();
});
test("progress dashboard renders activity, nutrition and recovery sections",async({page})=>{
 await page.goto("progress/");
 await expect(page.getByRole("heading",{name:/Progress & milestones/i})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Weight trend"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Nutrition trend"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Recovery snapshot"})).toBeVisible();
});
test("profile and body pages expose saved account data controls",async({page})=>{
 await page.goto("profile/");
 await expect(page.getByRole("heading",{name:"Profile"})).toBeVisible();
 await expect(page.getByRole("link",{name:/Privacy & data/i})).toBeVisible();
 await page.goto("body/");
 await expect(page.getByRole("heading",{name:"Your measurements"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Measurement history"})).toBeVisible();
});

test("fitness tracker records manual workout details",async({page})=>{
 await page.goto("fitness/");
 await expect(page.getByRole("heading",{name:"Fitness studio"})).toBeVisible();
 await expect(page.getByText(/Workout time · minutes/i)).toBeVisible();
 await expect(page.getByText(/Number of sessions/i)).toBeVisible();
 await expect(page.getByText(/No running timer to remember to stop/i)).toBeVisible();
});
test("friends zone exposes social feed, discovery and chats",async({page})=>{
 await page.goto("friends/");
 await expect(page.getByRole("heading",{name:"Friends"})).toBeVisible();
 await expect(page.getByRole("button",{name:/Feed/i})).toBeVisible();
 await expect(page.getByRole("button",{name:/Discover/i})).toBeVisible();
 await expect(page.getByRole("button",{name:/Chats/i})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Main navigation"})).toBeVisible();
});

test("all persistent bottom tabs navigate to real pages under the GitHub Pages base path",async({page})=>{
 await page.goto("./");
 const tabs=[
  {name:"Meals",path:/\\/luminaf\\/meals\\/$/,heading:"Meal scanner"},
  {name:"Fitness",path:/\\/luminaf\\/fitness\\/$/,heading:"Fitness studio"},
  {name:"Friends",path:/\\/luminaf\\/friends\\/$/,heading:"Friends"},
  {name:"Health",path:/\\/luminaf\\/health\\/$/,heading:"Health check-in"},
  {name:"Profile",path:/\\/luminaf\\/profile\\/$/,heading:"Profile"}
 ];
 for(const tab of tabs){
  await page.getByRole("navigation",{name:"Main navigation"}).getByRole("link",{name:tab.name,exact:true}).click();
  await expect(page).toHaveURL(tab.path);
  await expect(page.getByRole("heading",{name:tab.heading,exact:true})).toBeVisible();
 }
});
