// Opens each store's website in a real browser and records what it's built on:
// final address, page title, HTTP status, script hosts, and the data requests
// the page makes (that's usually where the prices come from).
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { UA } = require("./lib/http");

(async () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "stores.json"), "utf8"));
  const sites = [...new Set(cfg.stores.filter(s => s.website).map(s => s.website))];
  const browser = await chromium.launch();
  const report = {};
  for (const url of sites) {
    const ctx = await browser.newContext({ userAgent: UA });
    const page = await ctx.newPage();
    const scripts = new Set(), api = [];
    page.on("request", r => {
      const u = r.url(), t = r.resourceType();
      if (t === "script") { try { scripts.add(new URL(u).host); } catch {} }
      if ((t === "xhr" || t === "fetch") && api.length < 40) api.push(r.method() + " " + u.slice(0, 200));
    });
    const rec = { url };
    try {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      rec.status = res && res.status();
      rec.finalUrl = page.url();
      rec.title = await page.title();
      const html = await page.content();
      rec.generator = (html.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)/i) || [])[1] || "";
      rec.shopLinks = await page.$$eval("a[href]", as => [...new Set(as.map(a => a.href).filter(h => /shop|order|store|online|cart|product|deliver/i.test(h)))].slice(0, 15));
      rec.text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 400);
    } catch (e) { rec.error = e.message.slice(0, 200); }
    rec.scriptHosts = [...scripts];
    rec.dataRequests = api;
    report[url] = rec;
    console.log(JSON.stringify(rec, null, 1));
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname, "..", "site", "data", "diagnose.json"), JSON.stringify(report, null, 1));
})();
