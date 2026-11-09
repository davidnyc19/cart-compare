// Watches what Kosher West's website does when a shopper taps "Add to cart"
// on a guest cart (no account), so the one-tap "Fill my cart" button can do the same.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const out = { reqs: [] };
  page.on("request", r => { const t = r.resourceType(); if ((t === "xhr" || t === "fetch") && !/sentry|freshchat|google|ads-ms|HeaderLinks|Footer|SiteConfig/i.test(r.url()))
    out.reqs.push({ m: r.method(), u: r.url().slice(0, 300), h: Object.fromEntries(Object.entries(r.headers()).filter(([k]) => /content-type|x-|accept$/i.test(k))), body: (r.postData() || "").slice(0, 600) }); });
  page.on("response", async r => { const e = out.reqs.find(x => x.u === r.url().slice(0, 300) && !x.s); if (e) { e.s = r.status(); try { e.res = (await r.text()).slice(0, 500); } catch {} } });
  try {
    await page.goto("https://kosherwest.com/Lakewood-NJ/category/4892/avocado", { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(7000);
    const mark = out.reqs.length;
    // find an add-to-cart control
    const cands = await page.$$eval("button, a, [role=button], .btn, [onclick]", els => els.map((e, i) => ({ i, t: (e.innerText || e.title || e.getAttribute("aria-label") || "").trim().slice(0, 40), c: (e.className || "").toString().slice(0, 80), oc: (e.getAttribute("onclick") || "").slice(0, 120) })).filter(x => /add|cart|\+/i.test(x.t + x.c + x.oc)).slice(0, 25));
    out.cands = cands;
    const lsBefore = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).map(([k, v]) => [k, v.slice(0, 300)]))));
    out.lsBefore = lsBefore;
    const btn = page.locator(".add-to-cart-btn").first();
    if (await btn.count()) { out.clicked = await btn.evaluate(e => e.outerHTML.slice(0, 400)); await btn.click({ timeout: 8000 }); await page.waitForTimeout(6000);
      out.afterFirst = out.reqs.slice(mark).map(x => x.m + " " + x.u);
      const btn2 = page.locator(".add-to-cart-btn").nth(1); if (await btn2.count()) { await btn2.click({ timeout: 8000 }); await page.waitForTimeout(5000); } }
    out.lsAfter = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).map(([k, v]) => [k, v.slice(0, 1500)]))));
    out.ssAfter = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(sessionStorage).map(([k, v]) => [k, v.slice(0, 800)]))));
    out.cookieVals = (await ctx.cookies()).filter(c => /MCG/.test(c.name)).map(c => c.name + "=" + decodeURIComponent(c.value).slice(0, 600));
    await page.goto("https://kosherwest.com/Lakewood-NJ/cart", { waitUntil: "load", timeout: 60000 }).catch(() => {}); await page.waitForTimeout(5000);
    out.cartPage = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 600);
    out.after = out.reqs.slice(mark).map(x => x.m + " " + x.u);
    out.cookies = (await ctx.cookies()).map(c => c.name + " (" + c.domain + ")");
    out.cartText = (await page.evaluate(() => { const e = document.querySelector("[class*=cart], [id*=cart]"); return e ? e.innerText.slice(0, 300) : ""; }));
    out.globals = await page.evaluate(() => Object.keys(window).filter(k => /cart|basket|add/i.test(k)).slice(0, 40));
  } catch (e) { out.error = e.message.slice(0, 300); }
  await b.close();
  fs.writeFileSync(path.join(__dirname, "..", "site", "data", "diagnose-cart.json"), JSON.stringify(out, null, 1));
})();
