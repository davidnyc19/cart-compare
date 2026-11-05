// Stores on the MyCloudGrocer platform (Seasons, Aisle 9, Nutmeg, Kosher West).
// Opens the store's own page in a real browser (so the right branch is selected),
// reads the department list, then asks each department for its products,
// the same requests the store's website makes when a shopper browses.
const { allowed, UA } = require("../lib/http");

function findItems(node, out) {
  if (!node) return;
  if (typeof node === "string" && node.startsWith("[{") && node.includes('"P_v"')) { try { findItems(JSON.parse(node), out); } catch {} return; }
  if (Array.isArray(node)) { for (const x of node) findItems(x, out); return; }
  if (typeof node === "object") {
    if (node.N && node.P_v != null && node.Id != null) { out.push(node); return; }
    for (const k of Object.keys(node)) findItems(node[k], out);
  }
}
function leaves(tree, acc = []) { for (const c of tree || []) { if (c.List && c.List.length) leaves(c.List, acc); else acc.push(c); } return acc; }

async function scrape(origin, { seo = "", deadline = Infinity, log = () => {} } = {}) {
  if (!(await allowed(origin + "/proxy-api/AjaxFilter/JsonProductsList"))) throw new Error("robots.txt does not allow product requests");
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ userAgent: UA })).newPage();
    await page.goto(`${origin}/${seo}`, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(5000);
    const api = (path, body) => page.evaluate(async ([p, b]) => {
      const r = await fetch(p, b ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) } : {});
      return r.ok ? r.json() : { __status: r.status };
    }, [path, body || null]);
    if (process.env.MCG_DEBUG) {
      page.on("request", r => { if (/JsonProductsList/.test(r.url())) log("  DEBUG SITE-REQ headers=" + JSON.stringify(r.headers()).slice(0, 900)); });
      await page.goto(`${origin}/${seo}/category/4892/avocado`, { waitUntil: "load", timeout: 60000 }); await page.waitForTimeout(8000);
      const mineRes = await api(`/proxy-api/AjaxFilter/JsonProductsList?pageNumber=1&filterMode=00000000&storeId=1`, [{ FilterType: 0, Value1: "4892", categoryId: 0 }, { FilterType: 0, Value1: "4892", categoryId: "4892" }]);
      log("  DEBUG MINE count=" + (mineRes && mineRes.productsCount) + " status=" + (mineRes && mineRes.__status) + " keys=" + Object.keys(mineRes || {}).slice(0, 8));
      const t = await api(`/proxy-api/AjaxFilter/GetCategoryTreeJSON?filterMode=00000000&storeId=1`);
      log("  DEBUG TREE sample=" + JSON.stringify(t).slice(0, 300));
      return { items: [], checkout: "product-links" };
    }
    const stores = await api("/proxy-api/multistore/StoresDialogJSON");
    const mine = (stores.StoresList || []).find(s => seo && String(s.SeoLocation || "").toLowerCase() === seo.toLowerCase());
    const storeId = (mine && (mine.Id ?? mine.StoreId)) ?? stores.SelectedStoreId;
    log(`  branch: ${mine ? mine.StoreName : "default"} (store ${storeId})`);
    const tree = await api(`/proxy-api/AjaxFilter/GetCategoryTreeJSON?filterMode=00000000&storeId=${storeId}`);
    const cats = leaves(Array.isArray(tree) ? tree : []);
    log(`  ${cats.length} departments`);
    const seen = new Map();
    for (const [i, c] of cats.entries()) {
      if (Date.now() > deadline) { log("  time limit reached"); break; }
      let res;
      for (let pg = 1; pg <= 40; pg++) {
        const id = String(c.Id);
        res = await api(`/proxy-api/AjaxFilter/JsonProductsList?pageNumber=${pg}&filterMode=00000000&storeId=${storeId}`,
          [{ FilterType: 0, Value1: id, categoryId: 0 }, { FilterType: 0, Value1: id, categoryId: id }]);
        const found = []; findItems(res, found);
        let fresh = 0;
        for (const p of found) if (!seen.has(p.Id)) { seen.set(p.Id, { p, cat: c }); fresh++; }
        const size = (res && res.pager && res.pager.PageSize) || 120;
        if (!fresh || found.length < size) break;
        await page.waitForTimeout(700);
      }
      await page.waitForTimeout(700);
      if ((i + 1) % 25 === 0) log(`  ${i + 1}/${cats.length} departments, ${seen.size} products`);
    }
    const items = [...seen.values()].map(({ p, cat }) => {
      const per = p.PQ > 1 ? p.P_v / p.PQ : p.P_v; // "2 for $7" → $3.50 each
      return {
        name: String(p.N).replace(/[,\s]+$/, ""),
        brand: "", size: "",
        gtin: p.SKU || "",
        price: Math.round(per * 100) / 100,
        inStock: p.Active !== "False",
        image: p.iU ? `${origin}/api/content/images/thumbs/${p.iU}` : "",
        url: p.nU ? new URL(p.nU, origin).href : `${origin}/${seo}/category/${cat.Id}/${encodeURIComponent((cat.N || "").toLowerCase().replace(/\s+/g, "-"))}`,
        category: p.CN || cat.N || ""
      };
    }).filter(x => x.price > 0);
    return { items, checkout: "product-links" };
  } finally { await browser.close(); }
}

module.exports = { name: "mycloudgrocer", detect: async () => false, scrape };
