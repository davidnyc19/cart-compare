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
      for (const m of t.matchAll(/["'`]([^"'`]{0,60}(?:Cart|cart)[^"'`]{0,80})["'`]/g)) if (/\/|proxy|api|Json|JSON/.test(m[1])) found.add(m[1]);
      for (const m of t.matchAll(/.{0,220}(?:AddToCart|addToCart|AddProductToCart|UpdateCart|ShoppingCart\/)[^\n]{0,260}/g)) found.add("CTX: " + m[0].slice(0, 480));
      if (found.size) out.hits[u.slice(0, 150)] = [...found].slice(0, 40);
    }
    out.scriptCount = scripts.size;
  } catch (e) { out.error = e.message.slice(0, 300); }
  await b.close();
  fs.writeFileSync(path.join(__dirname, "..", "site", "data", "diagnose-cart.json"), JSON.stringify(out, null, 1));
})();
