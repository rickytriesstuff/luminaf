import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
 testDir:"./e2e",
 fullyParallel:true,
 forbidOnly:!!process.env.CI,
 retries:process.env.CI?1:0,
 reporter:"list",
 use:{baseURL:"http://127.0.0.1:3000/luminaf/",trace:"retain-on-failure",...devices["Desktop Chrome"]},
 webServer:{
  command:"npm run dev",
  url:"http://127.0.0.1:3000/luminaf/",
  reuseExistingServer:!process.env.CI,
  timeout:120_000,
  env:{...process.env,NEXT_PUBLIC_SITE_BASE_PATH:"/luminaf"},
 },
});
