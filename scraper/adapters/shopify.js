// Shopify stores publish their catalog at /products.json. Checkout handoff uses
// Shopify's cart link: https://store/cart/VARIANT:QTY,VARIANT:QTY
const { getJson } = require("../lib/http");

async function detect(origin) {
  try {
    const j = await getJson(origin + "/products.json?limit=1");
    return Array.isArray(j.products);
  } catch { return false; }
}

async function scrape(origin, { maxPages = 100, log = () => {} } = {}) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const j = await getJson(`${origin}/products.json?limit=250&page=${page}`);
    if (!j.products || !j.products.length) break;
    for (const p of j.products) {
      for (const v of p.variants || []) {
        const price = Number(v.price);
        if (!price) continue;
        out.push({
          name: p.title + (v.title && v.title !== "Default Title" ? " " + v.title : ""),
          brand: p.vendor || "",
          size: v.title && v.title !== "Default Title" ? v.title : "",
          gtin: v.barcode || "",
          price,
          inStock: v.available !== false,
          image: (v.featured_image && v.featured_image.src) || (p.images && p.images[0] && p.images[0].src) || "",
          url: `${origin}/products/${p.handle}${p.variants.length > 1 ? "?variant=" + v.id : ""}`,
          variantId: String(v.id),
          category: p.product_type || ""
        });
      }
    }
    log(`  page ${page}: ${out.length} items so far`);
  }
  return { items: out, checkout: "shopify-cart" };
}

module.exports = { name: "shopify", detect, scrape };
