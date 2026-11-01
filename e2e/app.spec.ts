import {expect,test} from "@playwright/test";
test("dashboard renders core wellness navigation",async({page})=>{
 await page.goto("/");
 await expect(page.getByRole("heading",{name:/your day, in balance/i})).toBeVisible();
 await expect(page.getByRole("link",{name:/habit garden/i}).first()).toBeVisible();
 await expect(page.getByRole("link",{name:/nutrition overview/i})).toBeVisible();
 await expect(page.getByRole("link",{name:/luminaf plus/i})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Main navigation"})).toBeVisible();
});
test("health check-in keeps its medical disclaimer visible",async({page})=>{
 await page.goto("/health");
 await expect(page.getByRole("heading",{name:"Health check-in"})).toBeVisible();
 await expect(page.getByText(/not medical advice or a diagnosis/i)).toBeVisible();
 await expect(page.getByText(/do not wait for this tool/i)).toBeVisible();
});
test("meal scanner labels image nutrition as an estimate",async({page})=>{
 await page.goto("/meals");
 await expect(page.getByRole("heading",{name:"Meal scanner"})).toBeVisible();
 await expect(page.getByText(/photograph a meal and let ai estimate the foods, portions and nutrition/i)).toBeVisible();
 await expect(page.getByText(/of 5 left today/i)).toBeVisible();
});
test("PWA manifest is served",async({request})=>{
 const response=await request.get("/manifest.webmanifest");
 expect(response.ok()).toBeTruthy();
 const manifest=await response.json();
 expect(manifest.name).toBe("Luminaf");
 expect(manifest.display).toBe("standalone");
});

test("fitness tracker records manual workout details",async({page})=>{
 await page.goto("/fitness");
 await expect(page.getByRole("heading",{name:"Fitness studio"})).toBeVisible();
 await expect(page.getByText(/Workout time · minutes/i)).toBeVisible();
 await expect(page.getByText(/Number of sessions/i)).toBeVisible();
 await expect(page.getByText(/No running timer to remember to stop/i)).toBeVisible();
});
test("friends zone exposes social feed, discovery and chats",async({page})=>{
 await page.goto("/friends");
 await expect(page.getByRole("heading",{name:"Friends"})).toBeVisible();
 await expect(page.getByRole("button",{name:/Feed/i})).toBeVisible();
 await expect(page.getByRole("button",{name:/Discover/i})).toBeVisible();
 await expect(page.getByRole("button",{name:/Chats/i})).toBeVisible();
 await expect(page.getByRole("navigation",{name:"Main navigation"})).toBeVisible();
});
