(function () {
"use strict";
const VERSION = "8";
function showErr(msg) {
  let b = document.getElementById("errbox");
  if (!b) { b = document.createElement("div"); b.id = "errbox"; document.body.appendChild(b); }
  b.textContent = "Something went wrong (version " + VERSION + "): " + msg;
}
window.addEventListener("error", e => showErr((e.message || "error") + (e.lineno ? " @" + e.lineno : "")));
window.addEventListener("unhandledrejection", e => showErr(String(e.reason && e.reason.message || e.reason)));
const $ = id => document.getElementById(id);
const money = n => "$" + n.toFixed(2);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const mem = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// pictures for items without a store photo
const ICON = { eggs: '<ellipse cx="12" cy="13" rx="6" ry="8"/>', dairy: '<path d="M8 3h8v3l2 3v12H6V9l2-3z"/><path d="M6 9h12"/>', bakery: '<path d="M3 15c0-4 4-7 9-7s9 3 9 7v2H3z"/><path d="M8 10l1 3M12 9v3M16 10l-1 3"/>', meat: '<circle cx="14" cy="10" r="6"/><path d="M10 14l-5 5M4 18l2 2"/>', fish: '<path d="M2 12c4-5 10-5 14 0-4 5-10 5-14 0z"/><path d="M16 12l5-4v8z"/>', produce: '<path d="M12 8c-3-2-8-1-8 5 0 5 4 8 6 8 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 6-3 6-8 0-6-5-7-8-5z"/><path d="M12 8c0-2 1-4 3-5"/>', pantry: '<rect x="6" y="5" width="12" height="15" rx="2"/><path d="M6 9h12M6 16h12"/>', snacks: '<path d="M6 4h12l-1 16H7z"/><path d="M6 4l2 3h8l2-3"/>', drinks: '<path d="M10 2h4v4l2 3v13H8V9l2-3z"/><path d="M8 13h8"/>', frozen: '<path d="M12 3v18M4 7.5l16 9M20 7.5l-16 9"/>', household: '<rect x="5" y="8" width="14" height="13" rx="2"/><path d="M9 8V5h6v3M9 13h6"/>' };
const TINT = { eggs: ["#fdf1d6", "#9a6b10"], dairy: ["#e2eefb", "#2f5f94"], bakery: ["#f8e7d2", "#8c5520"], meat: ["#f9e0de", "#9b2f2a"], fish: ["#ddf0f3", "#1f6b78"], produce: ["#e0f2e1", "#2e7a35"], pantry: ["#ece6f6", "#5a3f8c"], snacks: ["#fbe5ef", "#9a2f62"], drinks: ["#e3f0f8", "#245e82"], frozen: ["#e4f3fb", "#2a6f96"], household: ["#ebece8", "#4c5546"] };
const svg = (c, s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[c] || ICON.pantry}</svg>`;
const tint = c => { const t = TINT[c] || TINT.pantry; return `--t:${t[0]};--ti:${t[1]}`; };
const pic = p => `<span class="pic" style="${tint(p.c)}">${p.img && /^https?:/.test(p.img) ? `<img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.f))" data-f='${svg(p.c, 26)}'>` : svg(p.c, 26)}</span>`;

const CATS = [["Eggs", "@eggs", "eggs"], ["Milk", "@dairy", "dairy"], ["Challah", "challah", "bakery"], ["Chicken", "chicken", "meat"], ["Fish", "@fish", "fish"], ["Fruits & Veg", "@produce", "produce"], ["Drinks", "@drinks", "drinks"], ["Paper goods", "@household", "household"]];

let STORES = [], SITES = {}, AREAS = [], CAT = [], BY = new Map();
let area = mem.get("cc-area", null), list = mem.get("cc-list", []);
const save = () => { mem.set("cc-list", list); mem.set("cc-area", area); };
const unlisted = () => STORES.filter(s => s.area === area && !(s.siteId && SITES[s.siteId]));
const here = () => STORES.filter(s => s.area === area && s.siteId && SITES[s.siteId]);
const offer = (s, p) => { const o = p && p.o[s.siteId]; return o && o[3] !== 0 ? { price: o[0], url: o[1], variant: o[2] } : null; };
const lowest = p => Math.min(...here().map(s => (offer(s, p) || { price: Infinity }).price));
const stores = p => here().filter(s => offer(s, p)).length;
// Everyday staples: "Any eggs" = the cheapest dozen eggs at each store, etc.
// inc: every pattern must match the name; exc: none may; cat: product group.
const NOT_FOOD = /\b(pan|pans|bag|bags|cover|board|knife|tray|holder|dish|mold|plate|container|cutter|flavou?r|flavored|candy|munch|snack|chips?|crisps|sauce|soup|mix|seasoning|powder|salad|spread|dip)\b/;
const STAPLES = [
  { id: "eggs", label: "Eggs (dozen)", words: "eggs egg", cat: "eggs", inc: [/\beggs?\b/, /(dozen|\bdoz\b|\bdz\b|\b12\s*(ct|pk|count|pack)\b)/], exc: /(noodle|beater|white|liquid|substitute|18|30|half)/ },
  { id: "milk-gal", label: "Milk (gallon)", words: "milk gallon", inc: [/\bmilk\b/, /(gallon|\bgal\b|128\s*oz)/], exc: /(chocolate|choc|soy|almond|oat|coconut|rice|lactaid|goat|evaporated|condensed|powder|half|1\/2)/ },
  { id: "milk-half", label: "Milk (½ gallon)", words: "milk half", inc: [/\bmilk\b/, /(half gallon|1\/2 gal|64\s*oz|half-gallon)/], exc: /(chocolate|choc|soy|almond|oat|coconut|rice|goat|evaporated|condensed|powder)/ },
  { id: "challah", label: "Challah", words: "challah challa", inc: [/\bchall?ah\b/], exc: /(raw|dough|frozen|topping|roll|bun|mini|kugel|french toast|crumb|stuffing|crouton|flour|gluten|spelt|oat|whole wheat|cookie)/ },
  { id: "chicken-8", label: "Chicken, cut in 8", words: "chicken whole cut", cat: "meat", inc: [/\bchicken\b/, /(cut in 8|8 cut|cut up|whole chicken|whole broiler|\bbroiler)/], exc: /(soup|roast|bbq|cooked|grilled|marinated)/ },
  { id: "chicken-cutlets", label: "Chicken cutlets", words: "chicken cutlet cutlets breast", cat: "meat", inc: [/\bchicken\b/, /(cutlet|boneless breast|breast boneless|schnitzel)/], exc: /(breaded|fried|nugget|cooked|grilled|roast|marinated|frozen|deli|stuffed)/ },
  { id: "chicken-bottoms", label: "Chicken bottoms", words: "chicken bottoms legs", cat: "meat", inc: [/\bchicken\b/, /(bottoms?|leg quarter|legs?\b)/], exc: /(cooked|bbq|roast|grilled|marinated)/ },
  { id: "ground-beef", label: "Ground beef", words: "ground beef chopped meat", cat: "meat", inc: [/(ground|chopped)/, /(beef|meat)/], exc: /(turkey|chicken|veal|lamb|cooked|patties|burgers?)/ },
  { id: "salmon", label: "Salmon fillet", words: "salmon fish", cat: "fish", inc: [/\bsalmon\b/], exc: /(smoked|lox|nova|canned|can\b|burger|patt|sushi|roll|salad|spread|cooked|teriyaki|baked)/ },
  { id: "tomatoes", label: "Tomatoes", words: "tomatoes tomato", cat: "produce", inc: [/\btomato(es)?\b/], exc: /(sauce|paste|juice|dried|sun|ketchup|crushed|diced|canned|puree|soup|\d+(\.\d+)?\s*oz|tuscanini|peeled|\bcan\b)/ },
  { id: "cucumbers", label: "Cucumbers", words: "cucumbers cucumber cukes", cat: "produce", inc: [/\bcucumbers?\b/], exc: /(pickle|salad|dill|brine|\d+(\.\d+)?\s*oz|tuscanini|peeled|\bcan\b)/ },
  { id: "onions", label: "Onions", words: "onions onion", cat: "produce", inc: [/\bonions?\b/], exc: /(fried|crispy|soup|powder|rings?|flakes|dried|green|scallion|chopped frozen|\d+(\.\d+)?\s*oz|tuscanini|peeled|\bcan\b)/ },
  { id: "potatoes", label: "Potatoes", words: "potatoes potato", cat: "produce", inc: [/\bpotato(es)?\b/], exc: /(chips?|kugel|knish|fries|puffs|starch|flakes|mashed|latke|salad|sweet|baby food|\d+(\.\d+)?\s*oz|tuscanini|peeled|\bcan\b)/ },
  { id: "bananas", label: "Bananas", words: "bananas banana", cat: "produce", inc: [/\bbananas?\b/], exc: /(chips?|dried|bread|cake|muffin|yogurt|split|\d+(\.\d+)?\s*oz|tuscanini|peeled|\bcan\b)/ },
  { id: "apples", label: "Apples", words: "apples apple", cat: "produce", inc: [/\bapples?\b/], exc: /(juice|sauce|cider|chips?|dried|pie|cake|vinegar|strudel|crisp|rings|\d+(\.\d+)?\s*oz|tuscanini|peeled|\bcan\b)/ },
  { id: "seltzer", label: "Seltzer (1 liter)", words: "seltzer soda water", cat: "drinks", inc: [/\bseltzer\b/, /(33\.8|\b1\s*l(iter|tr|t)?\b)/], exc: /(flavou?r|lemon|lime|orange|berry|cherry|grape|peach|mango|single|1 lt)/ },
  { id: "grape-juice", label: "Grape juice (64 oz)", words: "grape juice kiddush", cat: "drinks", inc: [/\bgrape\b/, /\bjuice\b/, /(64\s*oz|half gallon|1\.89\s*l)/], exc: /(white|light|blend|cocktail|box|pouch|mini|kid)/ },
  { id: "foil-pans", label: "Foil pans 9×13", words: "foil pans aluminum 9x13", cat: "household", inc: [/(9\s*x\s*13|9 ?\* ?13|half size|1\/2 size)/], exc: /(lid|cover|only)/, allowNonFood: true },
  { id: "paper-towels", label: "Paper towels", words: "paper towels", cat: "household", inc: [/\bpaper towels?\b/], exc: /(holder)/, allowNonFood: true }
];
const SBY = new Map(STAPLES.map(x => [x.id, x]));
const GC = new Map();
function cands(k) {
  if (GC.has(k)) return GC.get(k);
  const st = SBY.get(k.slice(2)); let r = [];
  if (st) r = CAT.filter(p => { const h = p.n.toLowerCase(); return st.inc.every(re => re.test(h)) && !(st.exc && st.exc.test(h)) && (st.allowNonFood || !NOT_FOOD.test(h)); });
  GC.set(k, r); return r;
}
function staplesFor(term) {
  const t = term.trim().toLowerCase(); if (!t) return [];
  if (t.startsWith("@")) return STAPLES.filter(x => x.cat === t.slice(1) || (t === "@dairy" && /milk/.test(x.id)));
  const w = stem(t.split(/\s+/)[0]);
  return STAPLES.filter(x => x.words.split(" ").some(v => v.startsWith(w) || w.startsWith(v)));
}
function pick(s, k) {
  if (!k.startsWith("s:")) { const p = BY.get(k), o = offer(s, p); return o ? { p, o } : null; }
  let best = null;
  for (const p of cands(k)) { const o = offer(s, p); if (o && (!best || o.price < best.o.price)) best = { p, o }; }
  return best;
}
function item(k) {
  if (!k.startsWith("s:")) return BY.get(k);
  const st = SBY.get(k.slice(2)); if (!st) return null;
  return { k, n: st.label, sub: "Lowest price at each store", c: st.cat || (cands(k)[0] || {}).c || "pantry", img: "", generic: true };
}
const lowestK = k => Math.min(...here().map(s => (pick(s, k) || { o: { price: Infinity } }).o.price));
const storesK = k => here().filter(s => pick(s, k)).length;
function toast(m) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 1800); }

// ---------- finding items ----------
const q = $("q"), drop = $("drop"); let hits = [], sel = 0;
const stem = w => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
function find(term, n = 8) {
  let r;
  if (term.startsWith("@")) r = CAT.filter(p => p.c === term.slice(1));
  else {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean).map(stem); if (!words.length) return [];
    const whole = words.map(w => new RegExp("\\b" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(s|es)?\\b"));
    if (!CAT.length) return [];
    r = CAT.filter(p => { const h = (p.n + " " + p.b).toLowerCase(); return words.every(w => h.includes(w)); })
      .map(p => { const h = p.n.toLowerCase(); p._s = whole.every(re => re.test(h)) ? 2 : 0; p._s += whole[0].test(h.split(/[,(]/)[0].split(" ").slice(-2).join(" ")) ? 1 : 0; return p; });
  }
  return r.map(p => [p, stores(p)]).filter(x => x[1]).sort((a, b) => (b[0]._s || 0) - (a[0]._s || 0) || b[1] - a[1] || a[0].n.length - b[0].n.length).slice(0, n).map(x => x[0]);
}
let gens = [];
function showDrop() {
  const term = q.value.trim() || curCat;
  gens = staplesFor(term).map(x => "s:" + x.id).filter(k => storesK(k) >= 2).slice(0, 3);
  const rowH = (k, it, sub, gen) => { const q = (list.find(x => x.k === k) || {}).q || 0; return `<div class="opt${gen ? " gen" : ""}">${pic(it)}<span class="on-txt"><b>${esc(it.n)}</b><small>${sub}</small></span><button type="button" class="addb${q ? " in" : ""}" data-add="${esc(k)}">${q ? "✓ " + q : "Add"}</button></div>`; };
  const gen = gens.map(k => rowH(k, item(k), "Cheapest kind at each store · from " + money(lowestK(k)), true)).join("");
  drop.innerHTML = gen + (hits.length ? hits.map(p => rowH(p.k, p, "from " + money(lowest(p)), false)).join("")
    : (gen ? "" : `<div class="none">We couldn't find that yet. Try a shorter word, like “milk”.</div>`));
  drop.hidden = false;
}
let curCat = "";
q.addEventListener("input", () => { curCat = ""; hits = find(q.value); sel = 0; q.value.trim() ? showDrop() : drop.hidden = true; });
q.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); q.blur(); } });
q.addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { sel = Math.min(sel + 1, gens.length + hits.length - 1); showDrop(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); showDrop(); e.preventDefault(); }
  else if (e.key === "Enter" && (gens[sel] || hits[sel - gens.length])) { add(gens[sel] || hits[sel - gens.length].k); e.preventDefault(); }
  else if (e.key === "Escape") drop.hidden = true;
});
let lastAdd = 0, lastKey = "";
drop.addEventListener("click", e => {
  const b = e.target.closest("[data-add]"); if (!b) return;
  e.preventDefault(); if (b.dataset.add === lastKey && Date.now() - lastAdd < 300) return; lastAdd = Date.now(); lastKey = b.dataset.add;
  try { add(b.dataset.add); } catch (err) { showErr("add: " + err.message); }
  const q2 = (list.find(x => x.k === b.dataset.add) || {}).q || 0;
  b.textContent = "✓ " + q2; b.classList.add("in");
});

// ---------- compare one item across every store ----------
function compare(k) {
  const it = item(k); if (!it) return;
  const rows = here().map(s => ({ s, m: pick(s, k) })).sort((a, b) => (a.m ? a.m.o.price : Infinity) - (b.m ? b.m.o.price : Infinity));
  const lo = rows[0] && rows[0].m ? rows[0].m.o.price : null;
  const inCart = (list.find(x => x.k === k) || {}).q || 0;
  $("sheet").innerHTML = `<button class="close" id="x" aria-label="Close">✕</button>
    <div class="cmphead">${pic(it)}<div><h2>${esc(it.n)}</h2>${it.generic ? `<p class="sub">Lowest price for this at each store</p>` : ""}</div></div>
    <div class="cmp">${rows.map((r, i) => r.m ? `<div class="crow${r.m.o.price === lo ? " best" : ""}"><span class="n"><b>${esc(r.s.name)}</b>${it.generic ? `<small>${esc(r.m.p.n)}</small>` : ""}</span><span class="pr num">${money(r.m.o.price)}${r.m.o.price === lo ? "<small>Cheapest</small>" : `<small>+${money(r.m.o.price - lo)}</small>`}</span></div>`
      : `<div class="crow na"><span class="n"><b>${esc(r.s.name)}</b></span><span class="pr">Not carried</span></div>`).join("")}</div>
    <button class="big solid" id="addbtn">${inCart ? `Add another (you have ${inCart})` : "Add to cart"}</button>`;
  $("modal").hidden = false;
  $("x").onclick = () => $("modal").hidden = true;
  $("addbtn").onclick = () => {
    try { add(k); } catch (e) { showErr("add: " + e.message); }
    const n = list.reduce((a, i) => a + i.q, 0);
    $("sheet").innerHTML = `<div class="done"><div class="tick">✓</div><h2>Added to your cart</h2><p>${esc(it.n)} · you have ${n} item${n === 1 ? "" : "s"} in your cart</p>
      <button class="big solid" id="seecart">See my cart and the cheapest store</button><button class="big ghost" id="more">Keep shopping</button></div>`;
    $("seecart").onclick = () => { $("modal").hidden = true; $("listCard").scrollIntoView({ behavior: "smooth", block: "start" }); };
    $("more").onclick = () => { $("modal").hidden = true; q.focus(); };
  };
}
$("cats").innerHTML = CATS.map(([l, t, c]) => `<button class="cat" data-t="${t}"><span class="ic" style="${tint(c)}">${svg(c, 24)}</span>${l}</button>`).join("");
$("cats").addEventListener("click", e => { const b = e.target.closest(".cat"); if (!b || !CAT.length) return; hits = find(b.dataset.t); sel = 0; q.value = b.dataset.t.startsWith("@") ? "" : b.dataset.t; curCat = b.dataset.t.startsWith("@") ? b.dataset.t : ""; showDrop(); drop.scrollIntoView({ behavior: "smooth", block: "nearest" }); });
function add(k) { const x = list.find(i => i.k === k); x ? x.q++ : list.push({ k, q: 1 }); render(); toast("Added to cart ✓"); const nn = list.reduce((a, i) => a + i.q, 0); $("badge").textContent = nn; const bd = $("mylist"); bd.classList.remove("bump"); void bd.offsetWidth; bd.classList.add("bump"); }

// ---------- list ----------
function showList() {
  list = list.filter(x => x.k.startsWith("s:") ? SBY.has(x.k.slice(2)) && cands(x.k).length : BY.has(x.k));
  $("count").textContent = list.length ? list.length + (list.length === 1 ? " item" : " items") : "";
  $("count").hidden = !list.length;
  $("list").innerHTML = list.length ? list.map(x => { const p = item(x.k); return `<div class="row">${pic(p)}<span class="name" data-cmp="${esc(x.k)}">${esc(p.n)}${p.generic ? `<small class="gsub">${esc(p.sub)}</small>` : ""}</span><span class="qty"><button data-a="-" data-k="${esc(x.k)}" aria-label="One less">−</button><span class="num">${x.q}</span><button data-a="+" data-k="${esc(x.k)}" aria-label="One more">+</button></span></div>`; }).join("") + `<p style="margin:12px 0 0"><button class="link" id="clear">Empty cart</button></p>`
    : `<p class="empty">Your cart is empty. Tap a picture above or type what you need, then tap “Add to cart”.</p>`;
  const c = $("clear"); if (c) c.onclick = () => { list = []; render(); };
}
$("list").addEventListener("click", e => { const c = e.target.closest("[data-cmp]"); if (c) { compare(c.dataset.cmp); return; } const b = e.target.closest("button[data-a]"); if (!b) return; const x = list.find(i => i.k === b.dataset.k); if (!x) return; x.q += b.dataset.a === "+" ? 1 : -1; if (x.q < 1) list = list.filter(i => i !== x); render(); });

// ---------- the answer ----------
function totals() {
  return here().map(s => {
    let sub = 0; const miss = [];
    list.forEach(x => { const m = pick(s, x.k); m ? sub += m.o.price * x.q : miss.push(x.k); });
    const d = s.delivery || {}; const known = d.fee != null;
    const fee = known ? (d.freeOver != null && sub >= d.freeOver ? 0 : d.fee) : 0;
    return { s, sub, miss, known, fee, total: sub + fee, gap: d.freeOver != null ? d.freeOver - sub : null };
  }).sort((a, b) => a.miss.length - b.miss.length || a.total - b.total);
}
function showAnswer() {
  const A = $("answer"), bar = $("bar");
  bar.hidden = true;
  if (!here().length) { const an = (AREAS.find(a => a.id === area) || {}).name || "this area"; A.innerHTML = `<div class="card"><h2>${esc(an)}: coming soon</h2><p class="empty">We're adding the kosher stores in ${esc(an)}. For now, prices are ready for Lakewood · Jackson · Toms River.</p><button class="big solid" id="golkwd">Switch to Lakewood</button></div>`; $("golkwd").onclick = () => { area = AREAS[0].id; $("area").value = area; render(); }; return; }
  if (!list.length) { A.innerHTML = ""; return; }
  const R = totals(), w = R[0], full = R.filter(r => !r.miss.length);
  const save = full.length > 1 ? Math.max(...full.map(r => r.total)) - w.total : 0;
  const deliv = !w.known ? "plus delivery" : w.fee ? `includes ${money(w.fee)} delivery` : "free delivery";
  const names = R.map(r => r.s.name);
  A.innerHTML = `<div class="win"><div class="lbl">Cheapest store for your cart</div><h2>${esc(w.s.name)}</h2>
    <div class="total num">${money(w.total)} <small>${deliv}</small></div>
    ${save > 0.005 ? `<span class="save num">You save ${money(save)} vs. the most expensive store</span>` : ""}
    ${w.miss.length ? `<p class="note">Doesn't carry ${w.miss.length} of your items.</p>` : ""}
    ${w.known && w.fee && w.gap > 0 && w.gap < 25 ? `<p class="note">Add ${money(w.gap)} more for free delivery.</p>` : ""}
    <div class="brk">${list.map(x => { const m = pick(w.s, x.k), it = item(x.k); return `<div><span>${esc(m ? m.p.n : it.n)}${x.q > 1 ? " ×" + x.q : ""}</span><span class="num">${m ? money(m.o.price * x.q) : "not sold here"}</span></div>`; }).join("")}<div class="tot"><span>Total</span><span class="num">${money(w.sub)}</span></div></div>
    <button class="big" data-shop="${w.s.id}">Shop at ${esc(w.s.name)}</button></div>
  <div class="card"><h2>All ${R.length} stores compared</h2><p class="compared">${names.map(esc).join(" · ")}</p>
    ${R.map((r, i) => `<div class="store${i === 0 ? " first" : ""}"><span class="rk num">${i + 1}</span><span class="n"><b>${esc(r.s.name)}</b><small>${r.miss.length ? `Missing ${r.miss.length} item${r.miss.length > 1 ? "s" : ""}` : "Has everything"}</small></span><span class="t num">${money(r.total)}<small class="${i === 0 ? "ok" : ""}">${i === 0 ? "Cheapest" : r.total < w.total ? money(w.total - r.total) + " less, missing items" : "+" + money(r.total - w.total)}</small></span><button data-shop="${r.s.id}">Shop</button></div>`).join("")}
    ${unlisted().length ? `<p class="compared" style="margin-top:12px">Not compared (their websites block price checks or have no online shop): ${unlisted().map(s => esc(s.name)).join(", ")}</p>` : ""}
  </div>
  <details class="more"><summary>See every price</summary><div class="tablewrap"><table><thead><tr><th>Item</th>${here().map(s => `<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${list.map(x => { const it = item(x.k), lo = lowestK(x.k); return `<tr><td>${esc(it.n)}${x.q > 1 ? " ×" + x.q : ""}</td>${here().map(s => { const m = pick(s, x.k); return m ? `<td class="${m.o.price === lo ? "low" : ""}">${money(m.o.price)}${it.generic ? `<small class="what">${esc(m.p.n)}</small>` : ""}</td>` : `<td class="na">–</td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div></details>`;
  bar.innerHTML = `<div class="in"><div><small>Cheapest</small><b>${esc(w.s.name)} · <span class="num">${money(w.total)}</span></b></div><button data-shop="${w.s.id}">Shop now</button></div>`;
  bar.hidden = false;
}

// ---------- shop on the store's website ----------
document.addEventListener("click", e => {
  const b = e.target.closest("[data-shop]"); if (!b) return;
  const s = STORES.find(x => x.id === b.dataset.shop), site = SITES[s.siteId];
  const have = [], miss = [];
  list.forEach(x => { const m = pick(s, x.k); m ? have.push({ p: m.p, q: x.q, o: m.o }) : miss.push(item(x.k)); });
  const oneClick = site.checkout === "shopify-cart" && have.length && have.every(h => h.o.variant);
  const url = oneClick ? `${site.origin}/cart/${have.map(h => h.o.variant + ":" + h.q).join(",")}` : site.origin;
  const fill = site.checkout === "mcg-cart" && site.storeId != null && have.length && have.every(h => h.o.variant);
  const fillUrl = fill ? `${site.origin}/${s.seo || ""}#cartcompare=${site.storeId},${have.map(h => h.o.variant + ":" + h.q).join(",")}` : "";
  $("sheet").innerHTML = `<button class="close" id="x" aria-label="Close">✕</button><h2>Shop at ${esc(s.name)}</h2>
    ${!oneClick ? `<p>Tap each item. It opens on ${esc(s.name)}'s website. Tap “Add to cart” there, then come back for the next one.</p>
      <p class="prog" id="prog"></p>
      <div class="items check">${have.map((h, i) => `<a href="${esc(h.o.url || site.origin)}" target="_blank" rel="noopener" data-ci="${i}"><span class="box" aria-hidden="true"></span><span class="nm">${esc(h.p.n)}${h.q > 1 ? ` <b>×${h.q}</b>` : ""}<small class="num">${money(h.o.price * h.q)}</small></span><span class="go">Open →</span></a>`).join("")}</div>
      <a class="big solid" href="${esc(site.origin + "/" + (s.seo || ""))}" target="_blank" rel="noopener">Go to ${esc(s.name)} checkout</a>`
    : oneClick ? `<p>Tap below. Your ${have.length} items go straight into ${esc(s.name)}'s cart, and you pay on their website.</p><a class="big solid" href="${esc(url)}" target="_blank" rel="noopener">Go to ${esc(s.name)} checkout</a>`
      : `<p>Tap each item to add it on ${esc(s.name)}'s website, then check out there.</p><div class="items">${have.map(h => `<a href="${esc(h.o.url || site.origin)}" target="_blank" rel="noopener"><span>${esc(h.p.n)}${h.q > 1 ? " ×" + h.q : ""}</span><span>Open →</span></a>`).join("")}</div><a class="big solid" href="${esc(site.origin)}" target="_blank" rel="noopener">Open ${esc(s.name)} website</a>`}
    ${miss.length ? `<p style="margin-top:16px">Not sold here: ${miss.map(p => esc(p.n)).join(", ")}</p>` : ""}`;
  $("modal").hidden = false; $("x").onclick = () => $("modal").hidden = true;
  const doneKey = "cc-done-" + s.id, done = new Set(mem.get(doneKey, []));
  const prog = () => { const p = $("prog"); if (!p) return; const n = have.filter(h => done.has(h.p.k)).length; p.textContent = n === have.length ? `All ${n} items opened ✓ Now check out on ${s.name}'s website.` : `${n} of ${have.length} items opened`; };
  $("sheet").querySelectorAll("[data-ci]").forEach(a => { const h = have[+a.dataset.ci]; if (done.has(h.p.k)) a.classList.add("did");
    a.addEventListener("click", () => { done.add(h.p.k); mem.set(doneKey, [...done]); a.classList.add("did"); prog(); }); });
  prog();
});
$("modal").addEventListener("click", e => { if (e.target.id === "modal") $("modal").hidden = true; });
document.addEventListener("keydown", e => { if (e.key === "Escape") $("modal").hidden = true; });

// ---------- start ----------
function render() {
  for (const f of [showList, showAnswer, save]) { try { f(); } catch (e) { showErr(f.name + ": " + e.message); } }
  $("intro").hidden = list.length > 0;
  const n = list.reduce((a, i) => a + i.q, 0); $("badge").textContent = n;
  if (n && $("bar").hidden) { $("bar").innerHTML = `<div class="in"><div data-go="list"><small>Your cart</small><b>${n} item${n === 1 ? "" : "s"}</b></div></div>`; $("bar").hidden = false; }
  if (n) { const d = $("bar").querySelector(".in div"); d.dataset.go = "list"; d.querySelector("small").textContent = `${n} item${n === 1 ? "" : "s"} · Cheapest`; if (!$("bar").querySelector("button")) d.querySelector("small").textContent = "Your cart"; }
}
$("mylist").onclick = () => $("listCard").scrollIntoView({ behavior: "smooth", block: "start" });
document.addEventListener("click", e => { if (e.target.closest("[data-go=list]")) $("listCard").scrollIntoView({ behavior: "smooth", block: "start" }); });
$("area").addEventListener("change", e => { area = e.target.value; render(); });
q.placeholder = "Loading prices…"; q.disabled = true;
Promise.all([fetch("data/stores.json").then(r => r.json()), fetch("data/catalog.json").then(r => r.json())]).then(([st, cat]) => {
  STORES = st.stores; SITES = st.sites || {}; AREAS = st.areas; CAT = cat.products || []; CAT.forEach(p => BY.set(p.k, p));
  const vf = document.getElementById("ver"); if (vf) vf.textContent = "Version " + VERSION + " · " + CAT.length.toLocaleString() + " products";
  q.disabled = false; q.placeholder = "Type here… eggs, milk, challah";
  if (!AREAS.some(a => a.id === area)) area = AREAS[0].id;
  $("area").innerHTML = AREAS.map(a => `<option value="${a.id}"${a.id === area ? " selected" : ""}>${esc(a.name)}</option>`).join("");
  render();
}).catch(() => { $("answer").innerHTML = `<div class="card"><h2>Something didn't load</h2><p class="empty">Please refresh the page.</p></div>`; });
})();
