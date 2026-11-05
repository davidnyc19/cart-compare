#!/usr/bin/env node
// Nightly price robot. Usage:
//   node scraper/run.js                 scrape every store website
//   node scraper/run.js --only=gonpgs.com --max=200
//   node scraper/run.js --merge-only    rebuild the catalog from saved results
const fs = require("fs");
const path = require("path");
const shopify = require("./adapters/shopify");
const sitemap = require("./adapters/sitemap");
const { merge } = require("./lib/match");

const ROOT = path.join(__dirname, "..");
const STORES_FILE = process.env.STORES_FILE || path.join(ROOT, "stores.json");
const OUT = process.env.OUT_DIR || path.join(ROOT, "site", "data");
const RAW = path.join(OUT, "raw");
const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? true]; }));
const MAX = Number(args.max || 5000);
const ADAPTERS = { shopify, sitemap };

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const siteIdOf = url => new URL(url).host.replace(/^www\./, "");
const fileOf = id => id.replace(/[^a-z0-9.-]/gi, "_") + ".json";

async function pickAdapter(origin, wanted) {
  if (wanted && wanted !== "auto") return ADAPTERS[wanted];
  if (await shopify.detect(origin)) return shopify;
  if (await sitemap.detect(origin)) return sitemap;
  return null;
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(STORES_FILE, "utf8"));
  fs.mkdirSync(RAW, { recursive: true });
  const statusFile = path.join(OUT, "status.json");
  const status = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile, "utf8")) : {};

  // one scrape per website (chains with several branches share one site)
  const sites = new Map();
  for (const s of cfg.stores) {
    if (!s.website || s.adapter === "off") continue;
    const id = siteIdOf(s.website);
    if (!sites.has(id)) sites.set(id, { id, origin: new URL(s.website).origin, adapter: s.adapter });
  }

  if (!args["merge-only"]) {
    for (const site of sites.values()) {
      if (args.only && args.only !== site.id) continue;
      log(`▶ ${site.id}`);
      const st = status[site.id] = { ...(status[site.id] || {}), lastAttempt: new Date().toISOString() };
      try {
        const ad = await pickAdapter(site.origin, site.adapter);
        if (!ad) throw new Error("No public product catalog found (no Shopify feed, no product sitemap). Needs a custom adapter or the store sells through an app only.");
        log(`  using ${ad.name} adapter`);
        const res = await ad.scrape(site.origin, { maxPages: Math.ceil(MAX / 250), maxProducts: MAX, log });
        if (!res.items.length) throw new Error("Scrape finished but found 0 prices.");
        fs.writeFileSync(path.join(RAW, fileOf(site.id)), JSON.stringify({ siteId: site.id, origin: site.origin, adapter: ad.name, checkout: res.checkout, checkedAt: new Date().toISOString(), items: res.items }));
        Object.assign(st, { ok: true, adapter: ad.name, items: res.items.length, checkedAt: new Date().toISOString(), error: null });
        log(`  ✓ ${res.items.length} prices`);
      } catch (e) {
        Object.assign(st, { ok: false, error: e.message });
        log(`  ✗ ${e.message}`);
      }
    }
    await sitemap.close();
  }

  // merge everything saved (keeps yesterday's prices for a store that failed today)
  const raws = fs.readdirSync(RAW).filter(f => f.endsWith(".json")).map(f => JSON.parse(fs.readFileSync(path.join(RAW, f), "utf8")));
  const catalog = merge(raws);
  const siteMeta = Object.fromEntries(raws.map(r => [r.siteId, { origin: r.origin, checkout: r.checkout, checkedAt: r.checkedAt, items: r.items.length }]));
  const stores = cfg.stores.map(s => ({ ...s, siteId: s.website ? siteIdOf(s.website) : null }));
  fs.writeFileSync(path.join(OUT, "catalog.json"), JSON.stringify({ builtAt: new Date().toISOString(), products: catalog }));
  fs.writeFileSync(path.join(OUT, "stores.json"), JSON.stringify({ areas: cfg.areas, stores, sites: siteMeta }, null, 1));
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
  log(`Catalog: ${catalog.length} products from ${raws.length} store websites`);
  const failed = Object.entries(status).filter(([, v]) => !v.ok);
  if (failed.length) log(`Needs attention: ${failed.map(([k, v]) => `${k} (${v.error})`).join("; ")}`);
}

main().catch(e => { console.error(e); process.exit(1); });
