// Merge items from every store into one catalog so "eggs at Seasons" and
// "eggs at Kosher Village" land on the same row. Barcode first, then name+size.
const STOP = new Set(["the", "and", "with", "of", "a", "kosher", "fresh", "pack", "pk"]);
const UNIT = [[/\bounces?\b|\boz\.?/g, "oz"], [/\bpounds?\b|\blbs?\.?/g, "lb"], [/\bcount\b|\bct\.?/g, "ct"], [/\bliters?\b|\bltr\b/g, "l"], [/\bfl\.?\s*oz\b/g, "floz"], [/\bdozen\b|\bdoz\b/g, "12ct"]];

function normName(s) {
  s = String(s || "").toLowerCase().replace(/&amp;/g, "&").replace(/['’]/g, "");
  for (const [re, u] of UNIT) s = s.replace(re, u);
  s = s.replace(/(\d+(?:\.\d+)?)\s+(oz|lb|ct|l|floz|ml|g|kg)\b/g, "$1$2");
  return s.replace(/[^a-z0-9.]+/g, " ").split(" ").filter(t => t && !STOP.has(t)).sort().join(" ");
}
function normGtin(g) { g = String(g || "").replace(/\D/g, ""); if (g.length < 8) return ""; return g.replace(/^0+/, "").padStart(12, "0"); }

const CATS = [
  ["eggs", /^(?!.*(noodle|matzo|roll|salad|bagel|kichel|lokshen|pasta|barley|flake|bow|sandwich|wrap|platter|omelet|frittata|quiche|bites|patt)).*\beggs\b/], ["dairy", /\bmilk|cheese|yogurt|butter|cream\b|cholov/], ["bakery", /challah|bread|rolls?\b|bagel|pita|cake|rugelach|babka|cookie/],
  ["meat", /chicken|beef|turkey|flanken|brisket|meat|steak|pastrami|salami|lamb|veal|schnitzel|cutlet/], ["fish", /salmon|tuna|fish|tilapia|gefilte|sushi/],
  ["produce", /tomato|cucumber|onion|potato|lettuce|romaine|apple|banana|carrot|pepper|fruit|vegetable|berr|grape(?!.*juice)|lemon|avocado/],
  ["drinks", /juice|seltzer|water|soda|wine|coffee|tea\b|drink|beverage/], ["frozen", /frozen|ice cream|pops\b/],
  ["snacks", /chips|pretzel|chocolate|candy|snack|cracker|nosh/], ["household", /foil|paper|plate|cup|napkin|detergent|soap|bag|towel|tissue/]
];
function guessCat(name, cat) { const s = (name + " " + cat).toLowerCase(); for (const [c, re] of CATS) if (re.test(s)) return c; return "pantry"; }

function merge(sites) {
  // sites: [{ siteId, items: [...] }]
  const byKey = new Map();
  const gtinKey = new Map();
  for (const { siteId, items } of sites) {
    for (const it of items) {
      if (!it.name || !(it.price > 0)) continue;
      const g = normGtin(it.gtin);
      const nk = normName((it.brand && !it.name.toLowerCase().includes(it.brand.toLowerCase()) ? it.brand + " " : "") + it.name + " " + (it.name.includes(it.size) ? "" : it.size || ""));
      // barcode wins; names only join items that have no barcode (or a row that has none yet)
      let key = g ? (gtinKey.get(g) || (byKey.has(nk) && !byKey.get(nk)._g ? nk : "g:" + g)) : nk;
      let row = byKey.get(key);
      if (!row) { row = { k: key, n: it.name, b: it.brand || "", img: it.image || "", c: guessCat(it.name, it.category), o: {} }; byKey.set(key, row); }
      if (g) { gtinKey.set(g, key); row._g = true; }
      if (!row.img && it.image) row.img = it.image;
      const prev = row.o[siteId];
      if (!prev || it.price < prev[0]) row.o[siteId] = [Math.round(it.price * 100) / 100, it.url || "", it.variantId || "", it.inStock === false ? 0 : 1];
    }
  }
  // drop prices that are clearly for a case or multipack (over 3x what other stores charge)
  for (const row of byKey.values()) {
    const ids = Object.keys(row.o); if (ids.length < 3) continue;
    const bad = ids.filter(id => {
      const others = ids.filter(x => x !== id).map(x => row.o[x][0]).sort((a, b) => a - b);
      const med = others[Math.floor(others.length / 2)];
      return row.o[id][0] > med * 3 || row.o[id][0] < med / 3;
    });
    bad.forEach(id => delete row.o[id]);
  }
  for (const row of byKey.values()) delete row._g;
  return [...byKey.values()].filter(r => Object.keys(r.o).length);
}

module.exports = { merge, normName, normGtin, guessCat };
