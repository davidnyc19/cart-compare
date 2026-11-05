// Works on most store platforms: read the store's sitemap, open product pages,
// and pull the price from the page's structured data (schema.org Product).
// If a page builds its price with JavaScript, a real browser (Playwright) renders it.
const { getText, robotsFor, allowed } = require("../lib/http");

const locs = xml => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, "&"));
const looksLikeProduct = u => /\/(product|products|item|p|shop)\/|[?&](product|item)(_id|id)?=/i.test(u);

async function productUrls(origin, cap) {
  const { sitemaps } = await robotsFor(origin);
  const queue = sitemaps.length ? [...sitemaps] : [origin + "/sitemap.xml", origin + "/sitemap_index.xml"];
  const seen = new Set(), urls = new Set();
  while (queue.length && urls.size < cap) {
    const sm = queue.shift();
    if (seen.has(sm)) continue; seen.add(sm);
    let xml; try { xml = await getText(sm); } catch { continue; }
    for (const u of locs(xml)) {
      if (/\.xml(\.gz)?($|\?)/i.test(u)) { if (/product|item|catalog/i.test(u) || !/post|page|blog|categor/i.test(u)) queue.push(u); }
      else if (looksLikeProduct(u)) urls.add(u);
      if (urls.size >= cap) break;
    }
  }
  return [...urls];
}

function jsonLdProducts(html) {
  const found = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data; try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = n => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(walk);
      const t = [].concat(n["@type"] || []);
      if (t.includes("Product")) found.push(n);
      if (n["@graph"]) walk(n["@graph"]);
    };
    walk(data);
  }
  return found;
}

function fromLd(p, url) {
  const offers = [].concat(p.offers || []).flatMap(o => o && o.offers ? [].concat(o.offers) : [o]);
  const o = offers.find(x => x && (x.price || x.lowPrice)) || {};
  const price = Number(o.price || o.lowPrice);
  if (!price) return null;
  const brand = typeof p.brand === "string" ? p.brand : (p.brand && p.brand.name) || "";
  return {
    name: String(p.name || "").trim(),
    brand, size: p.size || p.weight && (p.weight.value + " " + (p.weight.unitText || "")) || "",
    gtin: p.gtin13 || p.gtin12 || p.gtin || p.gtin14 || p.gtin8 || "",
    price, inStock: !/OutOfStock/i.test(o.availability || ""),
    image: [].concat(p.image || [])[0] || "", url: o.url || url, category: p.category || ""
  };
}

let browser = null;
async function rendered(url) {
  if (!browser) { const { chromium } = require("playwright"); browser = await chromium.launch(); }
  const page = await browser.newPage({ userAgent: require("../lib/http").UA });
  try { await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }); return await page.content(); }
  finally { await page.close(); }
}

async function detect(origin) {
  const urls = await productUrls(origin, 3).catch(() => []);
  return urls.length > 0;
}

async function scrape(origin, { maxProducts = 5000, log = () => {} } = {}) {
  const urls = await productUrls(origin, maxProducts);
  log(`  ${urls.length} product pages found in sitemap`);
  const items = [];
  let useBrowser = false, misses = 0;
  for (const [i, url] of urls.entries()) {
    try {
      if (!(await allowed(url))) { misses++; continue; }
      let html = useBrowser ? await rendered(url) : await getText(url);
      let ps = jsonLdProducts(html);
      if (!ps.length && !useBrowser && i < 5) { html = await rendered(url); ps = jsonLdProducts(html); if (ps.length) { useBrowser = true; log("  switching to real browser (prices load with JavaScript)"); } }
      const it = ps.map(p => fromLd(p, url)).find(Boolean);
      if (it) items.push(it); else misses++;
      if (i === 20 && items.length === 0) throw new Error("No prices found on the first 20 product pages; this store needs a custom adapter.");
    } catch (e) { if (e.refused || /custom adapter/.test(e.message)) throw e; misses++; } // robots-blocked pages are skipped one by one
    if ((i + 1) % 100 === 0) log(`  ${i + 1}/${urls.length} pages, ${items.length} prices`);
  }
  return { items, checkout: "product-links" };
}

async function close() { if (browser) { await browser.close(); browser = null; } }

module.exports = { name: "sitemap", detect, scrape, close, _test: { jsonLdProducts, fromLd } };
