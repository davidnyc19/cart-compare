// Kosher Village: its website loads products from a public product-search service.
const { getJson } = require("../lib/http");
const TENANT = 2252;

function arr(j) { if (Array.isArray(j)) return j; for (const k of ["content", "items", "data", "results", "groceries", "hits"]) if (j && Array.isArray(j[k])) return j[k]; return null; }
const pick = (o, ...ks) => { for (const k of ks) { const v = k.split(".").reduce((a, x) => a && a[x], o); if (v != null && v !== "") return v; } return ""; };

async function scrape(origin, { deadline = Infinity, log = () => {} } = {}) {
  const base = `${origin}/api/services/supplier-ms/public/api/v1/groceries/_search?tenantId=${TENANT}&size=100&sort=originalId%2Cdesc`;
  const items = [];
  for (let page = 0; page < 300 && Date.now() < deadline; page++) {
    const j = await getJson(`${base}&page=${page}`);
    const list = arr(j);
    if (page === 0) { log("  response keys: " + Object.keys(j || {}).join(", ")); if (list && list[0]) log("  item keys: " + Object.keys(list[0]).join(", ")); }
    if (!list || !list.length) break;
    for (const g of list) {
      const price = Number(pick(g, "salePrice", "price", "regularPrice", "pricing.price", "prices.0.price"));
      const name = pick(g, "name", "title", "displayName", "description");
      if (!name || !(price > 0)) continue;
      const slug = pick(g, "slug", "seoName", "urlName");
      items.push({
        name: String(name), brand: String(pick(g, "brand.name", "brandName", "brand") || ""), size: String(pick(g, "size", "unitSize", "packageSize") || ""),
        gtin: String(pick(g, "upc", "barcode", "gtin", "sku") || ""), price,
        inStock: pick(g, "inStock", "available", "isAvailable") !== false,
        image: String(pick(g, "image.url", "imageUrl", "images.0.url", "images.0", "mainImage") || ""),
        url: slug ? `${origin}/product/${slug}` : `${origin}/products/store-specials`,
        category: String(pick(g, "category.name", "categoryName") || "")
      });
    }
    if (page % 10 === 9) log(`  ${items.length} products so far`);
    if (j && j.last === true) break;
  }
  return { items, checkout: "product-links" };
}

module.exports = { name: "koshervillage", detect: async () => false, scrape };
