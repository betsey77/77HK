import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type()==="error") errors.push("console:"+m.text()); });
const blocked = [];
await page.route("**/*", async route => {
  const u = new URL(route.request().url());
  if (!["localhost","127.0.0.1"].includes(u.hostname)) { blocked.push(u.href); await route.abort(); return; }
  if (u.pathname.startsWith("/api") || u.pathname.includes("/api/")) {
    await route.fulfill({ status:200, contentType:"application/json", body: JSON.stringify({ favorites:[], savedConfigs:[], brandProfile:null, planId:"free", monthlyLimit:20, used:0, remaining:20 }) });
    return;
  }
  await route.continue();
});
const res = await page.goto("http://127.0.0.1:5184/app", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(3000);
const body = await page.locator("body").innerText().catch(()=>"(no body)");
const html = await page.content();
console.log("status", res && res.status());
console.log("url", page.url());
console.log("bodyText", JSON.stringify(body).slice(0,800));
console.log("errors", errors);
console.log("blocked", blocked.slice(0,10));
console.log("htmlLen", html.length);
console.log("hasRoot", html.includes("id=\"root\""));
console.log("rootChildren", await page.locator("#root").innerHTML().catch(e=>String(e)));
await browser.close();
