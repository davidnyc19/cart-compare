// Looks at cbnshopsmart.com: which stores/areas it lists, and where its data comes from.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const { UA } = require("./lib/http");
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ userAgent: UA })).newPage();
  const reqs = [];
  page.on("response", async r => { const t = r.request().resourceType(); if (t !== "xhr" && t !== "fetch" && t !== "document") return;
    let body = ""; try { body = (await r.text()).slice(0, 2500); } catch {}
    reqs.push({ m: r.request().method(), u: r.url().slice(0, 300), s: r.status(), body }); });
  const out = {};
  try { out.robots = (await (await fetch("https://cbnshopsmart.com/robots.txt", { headers: { "User-Agent": UA } })).text()).slice(0, 800); } catch (e) { out.robots = "ERR " + e.message; }
  for (const u of ["https://cbnshopsmart.com/#browse", "https://cbnshopsmart.com/"]) {
    try { await page.goto(u, { waitUntil: "load", timeout: 60000 }); await page.waitForTimeout(8000);
      await page.mouse.wheel(0, 6000); await page.waitForTimeout(3000);
      out[u] = { title: await page.title(), text: (await page.evaluate(() => document.body.innerText)).slice(0, 12000),
        links: (await page.$$eval("a[href]", as => as.map(a => a.innerText.trim().slice(0, 40) + " => " + a.href))).slice(0, 80) };
    } catch (e) { out[u] = { error: e.message.slice(0, 200) }; }
  }
  out.requests = reqs.filter(x => !/google|gtag|analytics|fonts|cloudflareinsights/.test(x.u)).slice(0, 30);
  await b.close();
  fs.writeFileSync(path.join(__dirname, "..", "site", "data", "diagnose3.json"), JSON.stringify(out, null, 1));
})();
