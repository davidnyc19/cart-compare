// Kosher Village: its website loads products from a public product-search service.
const { getJson } = require("../lib/http");
const TENANT = 2252;

function arr(j) { if (Array.isArray(j)) return j; for (const k of ["content", "items", "data", "results", "groceries", "hits"]) if (j && Array.isArray(j[k])) return j[k]; return null; }
const pick = (o, ...ks) => { for (const k of ks) { const v = k.split(".").reduce((a, x) => a && a[x], o); if (v != null && v !== "") return v; } return ""; };

async function scrape(origin, { deadline = Infinity, log = () => {} } = {}) {
  const items = [], ids = new Set();
  for (const dir of ["desc", "asc"]) {
  const base = `${origin}/api/services/supplier-ms/public/api/v1/groceries/_search?tenantId=${TENANT}&size=100&sort=originalId%2C${dir}`;
  let freshInPass = 0;
  for (let page = 0; page < 100 && Date.now() < deadline; page++) {
    let j; try { j = await getJson(`${base}&page=${page}`); } catch (e) { log(`  stopped at page ${page}: ${e.message.slice(0, 80)}`); break; }
    const list = arr(j);
    if (false) { log("  response keys: " + Object.keys(j || {}).join(", ")); if (list && list[0]) log("  item keys: " + Object.keys(list[0]).join(", ")); }
    if (!list || !list.length) break;
    let fresh = 0;
    for (const g of list) {
      if (ids.has(g.id)) continue; ids.add(g.id); fresh++; freshInPass++;
      const gp = g.groceryPrice || {}, sp = g.searchPrice || {};
      const onSale = gp.specialPrice > 0 && gp.specialTo && gp.specialTo >= new Date().toISOString().slice(0, 10);
      const price = Number(onSale ? gp.specialPrice : (gp.basicPrice || sp.minPrice || sp.basicPrice || 0));
      const name = pick(g, "name", "title", "displayName", "description");
      if (!name || !(price > 0)) continue;
      const slug = pick(g, "seo.slug", "seo.url", "slug");
      items.push({
        name: String(name), brand: String(pick(g, "brand.name", "brandName", "brand") || ""), size: String(pick(g, "size", "unitSize", "packageSize") || ""),
        gtin: String(pick(g, "upc", "sku") || ""), price,
        inStock: pick(g, "inStock", "available", "isAvailable") !== false,
        image: String(pick(g, "mainImage.previewUrl", "mainImage.mainUrl", "mainImage", "images.0.url", "images.0") || ""),
        url: slug ? `${origin}/product/${slug}` : `${origin}/products/store-specials`,
        category: String(pick(g, "category.name", "categoryName") || "")
      });
    }
    if (page % 10 === 9) log(`  ${items.length} products so far`);
    if ((j && j.last === true) || (dir === "asc" && !fresh)) break;
  }
  log(`  ${dir}: ${freshInPass} products`);
  }
  return { items, checkout: "product-links" };
}

module.exports = { name: "koshervillage", detect: async () => false, scrape };
