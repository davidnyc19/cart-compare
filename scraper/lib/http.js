// Polite HTTP: identifies itself, waits between requests, obeys robots.txt.
const UA = process.env.SCRAPER_UA || "CartCompareBot/1.0 (kosher price comparison; contact via site)";
const DELAY_MS = Number(process.env.SCRAPER_DELAY_MS || 1200);

const robotsCache = new Map();
const lastByHost = new Map(); // politeness delay is per store website

async function wait(url) {
  const host = new URL(url).host;
  const next = Math.max(Date.now(), (lastByHost.get(host) || 0) + DELAY_MS);
  lastByHost.set(host, next);
  const ms = next - Date.now();
  if (ms > 0) await new Promise(r => setTimeout(r, ms));
}

async function rawGet(url, accept) {
  await wait(url);
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: accept || "*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(30000)
  });
  return res;
}

// Minimal robots.txt: rules for "User-agent: *" (and our own name), longest match wins.
function parseRobots(text) {
  const groups = [];
  let cur = null, lastWasAgent = false;
  const sitemaps = [];
  for (let line of text.split(/\r?\n/)) {
    line = line.replace(/#.*/, "").trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "sitemap") { sitemaps.push(val); continue; }
    if (key === "user-agent") {
      if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase()); lastWasAgent = true; continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "allow" || key === "disallow") cur.rules.push({ allow: key === "allow", path: val });
  }
  const mine = groups.find(g => g.agents.some(a => a && "cartcomparebot".includes(a) && a !== "*"))
    || groups.find(g => g.agents.includes("*"));
  return { rules: mine ? mine.rules.filter(r => r.path) : [], sitemaps };
}

function ruleMatches(path, rule) {
  const pat = "^" + rule.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$");
  return new RegExp(pat).test(path);
}

async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let parsed = { rules: [], sitemaps: [] };
  try {
    const r = await rawGet(origin + "/robots.txt", "text/plain");
    if (r.ok) parsed = parseRobots(await r.text());
  } catch {}
  robotsCache.set(origin, parsed);
  return parsed;
}

async function allowed(url) {
  const u = new URL(url);
  const { rules } = await robotsFor(u.origin);
  const path = u.pathname + u.search;
  let best = null;
  for (const r of rules) if (ruleMatches(path, r) && (!best || r.path.length > best.path.length)) best = r;
  return !best || best.allow;
}

async function get(url, accept) {
  if (!(await allowed(url))) { const e = new Error("Blocked by robots.txt: " + url); e.robots = true; throw e; }
  const res = await rawGet(url, accept);
  if (res.status === 429 || res.status === 403) { const e = new Error(`HTTP ${res.status} (store is refusing automated requests)`); e.refused = true; throw e; }
  return res;
}

async function getText(url) { const r = await get(url, "text/html,application/xml,*/*"); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.text(); }
async function getJson(url) { const r = await get(url, "application/json"); if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`); return r.json(); }

module.exports = { get, getText, getJson, robotsFor, allowed, UA };
