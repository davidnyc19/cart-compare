// Opens a department page on each store and records the data requests (with a
// sample of each response) that carry product names and prices. Also saves robots.txt.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const { UA } = require("./lib/http");
const TARGETS = [
  ["https://kosherwest.com/Lakewood-NJ", /depart|categor|produce|dairy/i],
  ["https://seasonskosher.com/", /lakewood/i],
  ["https://www.koshervillage.com/products/produce", null],
  ["https://gourmetglatt.com/", /lakewood/i]
];
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [url, follow] of TARGETS) {
    const ctx = await b.newContext({ userAgent: UA }); const page = await ctx.newPage();
    const caught = [];
    page.on("response", async r => {
      const t = r.request().resourceType(); if (t !== "xhr" && t !== "fetch") return;
      let body = ""; try { body = (await r.text()).slice(0, 1500); } catch {}
      if (/price|Price|name|Name/.test(body)) caught.push({ method: r.request().method(), url: r.url().slice(0, 400), post: (r.request().postData() || "").slice(0, 400), status: r.status(), body });
    });
    const rec = { url };
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
      if (follow) {
        const links = await page.$$eval("a[href]", as => as.map(a => ({ h: a.href, t: a.innerText.trim() })));
        rec.links = links.filter(l => l.h.startsWith(new URL(location.href).origin || "http")).slice(0, 60);
        const pick = links.find(l => follow.test(l.h + " " + l.t) && !/store-location|delivery/i.test(l.h));
        if (pick) { rec.followed = pick; await page.goto(pick.h, { waitUntil: "networkidle", timeout: 45000 });
          const l2 = await page.$$eval("a[href]", as => as.map(a => ({ h: a.href, t: a.innerText.trim() })));
          const dep = l2.find(l => /depart|categor|produce|dairy|grocer/i.test(l.h + " " + l.t) && !/store-location|delivery/i.test(l.h));
          if (dep) { rec.followed2 = dep; await page.goto(dep.h, { waitUntil: "networkidle", timeout: 45000 }); } }
      }
      await page.mouse.wheel(0, 4000); await page.waitForTimeout(2500);
      rec.finalUrl = page.url();
      try { const rb = await (await fetch(new URL(url).origin + "/robots.txt", { headers: { "User-Agent": UA } })).text(); rec.robots = rb.slice(0, 1500); } catch (e) { rec.robots = "ERR " + e.message; }
    } catch (e) { rec.error = e.message.slice(0, 300); }
    rec.data = caught.slice(0, 12);
    out[url] = rec; await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(__dirname, "..", "site", "data", "diagnose2.json"), JSON.stringify(out, null, 1));
})();
