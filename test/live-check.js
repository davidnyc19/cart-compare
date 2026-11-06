// Opens the LIVE site on a simulated iPhone (Safari engine) and Android (Chrome engine),
// adds items like a shopper would, and reports what happened.
const { webkit, chromium, devices } = require("playwright");
const URL = process.env.SITE_URL || "https://davidnyc19.github.io/cart-compare/";
(async () => {
  for (const [name, bt, dev] of [["iPhone Safari", webkit, "iPhone 13"], ["Android Chrome", chromium, "Pixel 7"]]) {
    const b = await bt.launch(); const p = await b.newPage({ ...devices[dev] });
    const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
    try {
      await p.goto(URL, { waitUntil: "load" }); await p.waitForTimeout(3000);
      const v = await p.evaluate(() => [...document.scripts].map(s => s.src).join(" "));
      await p.tap("#q"); await p.keyboard.type("milk"); await p.waitForTimeout(800);
      const opts = await p.$$eval(".opt b", o => o.map(x => x.innerText).slice(0, 3));
      const ver = await p.$eval("#ver", e => e.textContent).catch(() => "?");
      console.log("--- " + name + " " + ver);
      await p.tap("[data-add] >> nth=0"); await p.waitForTimeout(800);
      await p.fill("#q", "eggs"); await p.waitForTimeout(800); await p.tap("[data-add] >> nth=0"); await p.waitForTimeout(800);
      const rows = await p.$$eval("#list .row", r => r.map(x => x.innerText.split("\n")[0]));
      const badge = await p.$eval("#badge", e => e.textContent).catch(() => "NO BADGE");
      const bar = await p.$eval("#bar", e => e.hidden ? "hidden" : e.innerText.replace(/\n/g, " | ")).catch(() => "?");
      await p.tap(".bar button").catch(() => {}); await p.waitForTimeout(800);
      const sheet = await p.$eval("#modal", e => e.hidden ? "hidden" : e.innerText.replace(/\n/g, " | ").slice(0, 300)).catch(() => "?");
      console.log(`=== ${name}\n scripts: ${v}\n options: ${JSON.stringify(opts)}\n list: ${JSON.stringify(rows)}\n badge: ${badge}\n bottom bar: ${bar}\n shop sheet: ${sheet}\n errors: ${JSON.stringify(errs)}`);
      await p.screenshot({ path: `live-${dev.replace(/ /g, "")}.png`, fullPage: true });
    } catch (e) { console.log(`=== ${name} FAILED: ${e.message.slice(0, 300)} errors: ${JSON.stringify(errs)}`); }
    await b.close();
  }
})();
