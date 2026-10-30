import {expect,test} from "@playwright/test";
test("dashboard renders core wellness navigation",async({page})=>{
 await page.goto("/");
 await expect(page.getByRole("heading",{name:/your day, in balance/i})).toBeVisible();
 await expect(page.getByRole("link",{name:/habit garden/i}).first()).toBeVisible();
 await expect(page.getByRole("link",{name:/nutrition overview/i})).toBeVisible();
 await expect(page.getByRole("link",{name:/luminaf plus/i})).toBeVisible();
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
 await expect(page.getByText(/estimate its nutrition/i)).toBeVisible();
});
test("PWA manifest is served",async({request})=>{
 const response=await request.get("/manifest.webmanifest");
 expect(response.ok()).toBeTruthy();
 const manifest=await response.json();
 expect(manifest.name).toBe("Luminaf");
 expect(manifest.display).toBe("standalone");
});
