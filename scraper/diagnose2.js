const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const { UA } = require("./lib/http");
const TARGETS = [
  ["https://www.gourmetglattonline.com/", ["Produce", "Dairy", "Grocery", "Lakewood"]]
];
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [url, clicks] of TARGETS) {
    const origin = new URL(url).origin, rec = { url };
    try { rec.robots = (await (await fetch(origin + "/robots.txt", { headers: { "User-Agent": UA } })).text()).slice(0, 1200); } catch (e) { rec.robots = "ERR " + e.message; }
    const ctx = await b.newContext({ userAgent: UA }); const page = await ctx.newPage();
    const caught = [];
    page.on("response", async r => {
      const t = r.request().resourceType(); if (t !== "xhr" && t !== "fetch") return;
      if (/HeaderLinks|SiteConfig|StoresDialog|Footer|Customer\/|sentry|freshchat|ads-ms/.test(r.url())) return;
      let body = ""; try { body = (await r.text()).slice(0, 1200); } catch {}
      caught.push({ method: r.request().method(), url: r.url().slice(0, 500), post: (r.request().postData() || "").slice(0, 500), status: r.status(), body });
    });
    try {
      await page.goto(url, { waitUntil: "load", timeout: 45000 }); await page.waitForTimeout(6000);
      rec.links = (await page.$$eval("a[href]", as => as.map(a => a.innerText.trim().slice(0, 30) + " => " + a.href))).filter(x => !/facebook|instagram|google|mailto|tel:/.test(x)).slice(0, 40);
      const before = caught.length;
      if (clicks) for (const t of clicks) { const el = page.getByText(t, { exact: true }).first(); if (await el.count()) { rec.clicked = t; await el.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(6000); break; } }
      rec.afterClickUrl = page.url(); rec.newRequests = caught.length - before;
      await page.mouse.wheel(0, 5000); await page.waitForTimeout(3000);
    } catch (e) { rec.error = e.message.slice(0, 300); }
    rec.data = caught.slice(-10);
    out[url] = rec; await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(__dirname, "..", "site", "data", "diagnose2.json"), JSON.stringify(out, null, 1));
})();
