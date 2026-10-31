import {expect,test} from "@playwright/test";
test("dashboard renders core wellness navigation",async({page})=>{
 await page.goto("./");
 await expect(page.getByRole("heading",{name:/your day, in balance/i})).toBeVisible();
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
 await page.getByRole("link",{name:/dashboard/i}).click();
 await page.getByRole("link",{name:"Profile and settings"}).click();
 await expect(page).toHaveURL(/\/luminaf\/profile\/$/);
 await expect(page.getByRole("heading",{name:"Profile & settings"})).toBeVisible();
});
test("deferred premium and push pages show clear release status",async({page})=>{
 await page.goto("subscribe/");
 await expect(page.getByRole("heading",{name:/Premium features are coming later/i})).toBeVisible();
 await page.goto("reminders/");
 await expect(page.getByRole("heading",{name:/Reminders are coming later/i})).toBeVisible();
 await page.goto("notifications/");
 await expect(page.getByRole("heading",{name:/Notifications are coming later/i})).toBeVisible();
});
test("health check-in keeps its medical disclaimer visible",async({page})=>{
 await page.goto("health/");
 await expect(page.getByRole("heading",{name:"Health check-in"})).toBeVisible();
 await expect(page.getByText(/not medical advice or a diagnosis/i)).toBeVisible();
 await expect(page.getByText(/do not wait for this tool/i)).toBeVisible();
});
test("manual meal journal renders without AI scanner credentials",async({page})=>{
 await page.goto("meals/");
 await expect(page.getByRole("heading",{name:"Log a meal"})).toBeVisible();
 await expect(page.getByLabel("Food name")).toBeVisible();
 await expect(page.getByRole("button",{name:"Save meal"})).toBeDisabled();
 await expect(page.getByText(/AI photo scanning will be added in a later release/i)).toBeVisible();
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
 await expect(page.getByRole("heading",{name:"Profile & settings"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Your data"})).toBeVisible();
 await page.goto("body/");
 await expect(page.getByRole("heading",{name:"Your measurements"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Measurement history"})).toBeVisible();
});
