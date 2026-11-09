// Reads the store website's own code to find the add-to-cart request it uses.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext()).newPage();
  const scripts = new Set(); page.on("request", r => { if (r.resourceType() === "script") scripts.add(r.url()); });
  const out = { hits: {} };
  try {
    await page.goto("https://kosherwest.com/Lakewood-NJ/category/4892/avocado", { waitUntil: "load", timeout: 60000 }); await page.waitForTimeout(6000);
    for (const u of scripts) {
      if (!/kosherwest|mycloudgrocer/i.test(u)) continue;
      let t = ""; try { t = await (await fetch(u)).text(); } catch { continue; }
      const found = new Set();
      for (const m of t.matchAll(/.{0,500}AddStoreProductsToCart[^\n]{0,500}/g)) found.add("CTX: " + m[0].slice(0, 1000));
      for (const m of t.matchAll(/.{0,40}path:`proxy-api|.{0,300}const q=|.{0,200}baseUrl.{0,200}/g)) found.add("BASE: " + m[0].slice(0, 500));
      if (found.size) out.hits[u.slice(0, 150)] = [...found].slice(0, 40);
    }
    out.scriptCount = scripts.size;
    out.sample = await page.evaluate(async () => {
      const r = await fetch("/proxy-api/AjaxFilter/JsonProductsList?pageNumber=1&filterMode=00000000&storeId=1", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify([{ FilterType: 0, Value1: "4892", categoryId: 0 }, { FilterType: 0, Value1: "4892", categoryId: "4892" }]) });
      const j = await r.json(); let p = j.productsJson; if (typeof p === "string") p = JSON.parse(p);
      return JSON.stringify(Array.isArray(p) ? p[0] : p).slice(0, 2500);
    });
    out.stores = await page.evaluate(async () => JSON.stringify(await (await fetch("/proxy-api/multistore/StoresDialogJSON", { headers: { "X-Requested-With": "XMLHttpRequest" } })).json()).slice(0, 1500));
  } catch (e) { out.error = e.message.slice(0, 300); }
  await b.close();
  fs.writeFileSync(path.join(__dirname, "..", "site", "data", "diagnose-cart.json"), JSON.stringify(out, null, 1));
})();
