// End-to-end test: starts two fake stores on this computer (one Shopify-style,
// one sitemap + product pages), runs the real scraper against them, checks the catalog.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("assert");

const A = [ // shopify-style store
  { id: 1, title: "Large Eggs", vendor: "Farm Fresh", handle: "large-eggs", variants: [{ id: 11, title: "12 ct", price: "3.49", barcode: "0012345678905", available: true }] },
  { id: 2, title: "Whole Milk Cholov Yisroel", vendor: "Golden Flow", handle: "whole-milk", variants: [{ id: 21, title: "1 Gallon", price: "6.19", barcode: "", available: true }] },
  { id: 3, title: "Plain Challah", vendor: "Store Bakery", handle: "challah", variants: [{ id: 31, title: "Default Title", price: "5.99", barcode: "", available: false }] }
];
const B = [ // sitemap store
  { slug: "eggs-large-dozen", name: "Farm Fresh Large Eggs 1 Dozen", gtin13: "0012345678905", price: "3.29" },
  { slug: "golden-flow-whole-milk", name: "Golden Flow Whole Milk Cholov Yisroel 1 gallon", price: "5.99" },
  { slug: "kedem-grape-juice", name: "Kedem Concord Grape Juice 64 oz", price: "6.89" },
  { slug: "secret", name: "Should Not Be Scraped", price: "1.00" }
];

function serve(port, handler) { return new Promise(r => { const s = http.createServer(handler).listen(port, () => r(s)); }); }

(async () => {
  const sA = await serve(4101, (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/robots.txt") return res.end("User-agent: *\nDisallow: /checkout\n");
    if (u.pathname === "/products.json") {
      const page = Number(u.searchParams.get("page") || 1);
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ products: page === 1 ? A : [] }));
    }
    res.statusCode = 404; res.end();
  });
  const sB = await serve(4102, (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/robots.txt") return res.end("User-agent: *\nDisallow: /product/secret\nSitemap: http://localhost:4102/sitemap.xml\n");
    if (u.pathname === "/sitemap.xml") return res.end(`<urlset>${B.map(p => `<url><loc>http://localhost:4102/product/${p.slug}</loc></url>`).join("")}<url><loc>http://localhost:4102/about</loc></url></urlset>`);
    const p = B.find(x => "/product/" + x.slug === u.pathname);
    if (p) return res.end(`<html><head><script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: p.name, gtin13: p.gtin13, offers: { "@type": "Offer", price: p.price, priceCurrency: "USD", availability: "https://schema.org/InStock" } })}</script></head><body>${p.name}</body></html>`);
    res.statusCode = 404; res.end();
  });

  const out = path.join(__dirname, "out");
  fs.rmSync(out, { recursive: true, force: true });
  const storesFile = path.join(__dirname, "stores.test.json");
  fs.writeFileSync(storesFile, JSON.stringify({
    areas: [{ id: "lakewood", name: "Lakewood, NJ", zips: ["08701"] }],
    stores: [
      { id: "store-a", name: "Test Store A", area: "lakewood", zip: "08701", address: "1 Test St", website: "http://localhost:4101", adapter: "auto", delivery: { fee: 5.99, freeOver: 100, minimum: 30 } },
      { id: "store-b", name: "Test Store B", area: "lakewood", zip: "08701", address: "2 Test St", website: "http://localhost:4102", adapter: "auto", delivery: { fee: 4.99, freeOver: 120, minimum: 25 } }
    ]
  }));
  try {
    await new Promise((resolve, reject) => {
      const p = spawn("node", [path.join(__dirname, "..", "scraper", "run.js")], { env: { ...process.env, STORES_FILE: storesFile, OUT_DIR: out, SCRAPER_DELAY_MS: "10" }, stdio: "inherit" });
      p.on("exit", c => c === 0 ? resolve() : reject(new Error("scraper exited " + c)));
    });
  } finally { sA.close(); sB.close(); }

  const cat = JSON.parse(fs.readFileSync(path.join(out, "catalog.json"))).products;
  const find = re => cat.find(p => re.test(p.n));
  const eggs = find(/eggs/i), milk = find(/milk/i), challah = find(/challah/i);
  assert.deepEqual(Object.keys(eggs.o).sort(), ["localhost:4101", "localhost:4102"], "eggs matched across stores by barcode");
  assert.deepEqual(Object.keys(milk.o).sort(), ["localhost:4101", "localhost:4102"], "milk matched across stores by name + size");
  assert.equal(eggs.o["localhost:4102"][0], 3.29);
  assert.equal(eggs.o["localhost:4101"][2], "11", "Shopify variant id kept for cart handoff");
  assert.equal(challah.o["localhost:4101"][3], 0, "out-of-stock flag kept");
  assert(find(/grape juice/i), "sitemap store product present");
  assert(!cat.some(p => /should not be scraped/i.test(p.n)), "robots.txt Disallow was respected");
  fs.copyFileSync(path.join(out, "catalog.json"), path.join(out, "catalog.copy.json"));
  console.log("\nPASS: scraper ran, respected robots.txt, built catalog of", cat.length, "products");
})().catch(e => { console.error("FAIL", e); process.exit(1); });
