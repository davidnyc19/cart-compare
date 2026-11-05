(function () {
"use strict";
const $ = id => document.getElementById(id);
const money = n => "$" + n.toFixed(2);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const store = { get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
function ago(iso) { if (!iso) return "never"; const h = (Date.now() - new Date(iso)) / 36e5; if (h < 1) return "under an hour ago"; if (h < 24) return Math.round(h) + " hours ago"; return Math.round(h / 24) + " days ago"; }

// ---------- icons for products without a photo ----------
const ICON = { eggs: '<ellipse cx="12" cy="13" rx="6" ry="8"/>', dairy: '<path d="M8 3h8v3l2 3v12H6V9l2-3z"/><path d="M6 9h12"/>', bakery: '<path d="M3 15c0-4 4-7 9-7s9 3 9 7v2H3z"/><path d="M8 10l1 3M12 9v3M16 10l-1 3"/>', meat: '<circle cx="14" cy="10" r="6"/><path d="M10 14l-5 5M4 18l2 2"/>', fish: '<path d="M2 12c4-5 10-5 14 0-4 5-10 5-14 0z"/><path d="M16 12l5-4v8z"/>', produce: '<path d="M12 8c-3-2-8-1-8 5 0 5 4 8 6 8 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 6-3 6-8 0-6-5-7-8-5z"/><path d="M12 8c0-2 1-4 3-5"/>', pantry: '<rect x="6" y="5" width="12" height="15" rx="2"/><path d="M6 9h12M6 16h12"/>', snacks: '<path d="M6 4h12l-1 16H7z"/><path d="M6 4l2 3h8l2-3"/>', drinks: '<path d="M10 2h4v4l2 3v13H8V9l2-3z"/><path d="M8 13h8"/>', frozen: '<path d="M12 3v18M4 7.5l16 9M20 7.5l-16 9"/>', household: '<rect x="5" y="8" width="14" height="13" rx="2"/><path d="M9 8V5h6v3M9 13h6"/>' };
const TINT = { eggs: ["#fdf1d6", "#9a6b10"], dairy: ["#e2eefb", "#2f5f94"], bakery: ["#f8e7d2", "#8c5520"], meat: ["#f9e0de", "#9b2f2a"], fish: ["#ddf0f3", "#1f6b78"], produce: ["#e0f2e1", "#2e7a35"], pantry: ["#ece6f6", "#5a3f8c"], snacks: ["#fbe5ef", "#9a2f62"], drinks: ["#e3f0f8", "#245e82"], frozen: ["#e4f3fb", "#2a6f96"], household: ["#ebece8", "#4c5546"] };
function thumb(p) {
  const t = TINT[p.c] || TINT.pantry;
  if (p.img && /^https?:\/\//.test(p.img)) return `<span class="thumb" style="--tint:${t[0]};--tint-ink:${t[1]}"><img src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
  return `<span class="thumb" style="--tint:${t[0]};--tint-ink:${t[1]}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[p.c] || ICON.pantry}</svg></span>`;
}

// ---------- state ----------
let STORES = [], SITES = {}, AREAS = [], CAT = [], BY = new Map();
let area = store.get("cc-area", null), list = store.get("cc-list", []), cart = store.get("cc-cart", {});
const save = () => { store.set("cc-list", list); store.set("cc-cart", cart); store.set("cc-area", area); };
const areaStores = () => STORES.filter(s => s.area === area && s.siteId && SITES[s.siteId]);
const offer = (s, p) => { const o = p && p.o[s.siteId]; return o && o[3] !== 0 ? { price: o[0], url: o[1], variant: o[2] } : null; };
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200); }

// ---------- search ----------
const q = $("q"), drop = $("drop"); let hits = [], sel = 0;
function coverage(p) { return areaStores().filter(s => offer(s, p)).length; }
function lowest(p) { let m = Infinity; areaStores().forEach(s => { const o = offer(s, p); if (o && o.price < m) m = o.price; }); return m; }
function search(term, n = 8) {
  const words = term.trim().toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return [];
  const r = [];
  for (const p of CAT) { const hay = (p.n + " " + p.b).toLowerCase(); if (words.every(w => hay.includes(w))) { const cov = coverage(p); if (cov) r.push([p, cov, hay.startsWith(words[0]) ? 1 : 0]); } }
  r.sort((a, b) => b[1] - a[1] || b[2] - a[2] || a[0].n.length - b[0].n.length);
  return r.slice(0, n).map(x => x[0]);
}
function renderDrop() {
  if (!q.value.trim()) { drop.hidden = true; return; }
  drop.innerHTML = hits.length ? hits.map((p, i) => `<button class="opt${i === sel ? " on" : ""}" data-k="${esc(p.k)}">${thumb(p)}<span class="meta"><b>${esc(p.n)}</b><span>${esc(p.b || p.c)} · ${coverage(p)} stores</span></span><span class="from num">from ${money(lowest(p))}</span></button>`).join("")
    : `<div class="empty">No match for “${esc(q.value)}” in this area's stores yet.</div>`;
  drop.hidden = false;
}
q.addEventListener("input", () => { hits = search(q.value); sel = 0; renderDrop(); });
q.addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { sel = Math.min(sel + 1, hits.length - 1); renderDrop(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); renderDrop(); e.preventDefault(); }
  else if (e.key === "Enter" && hits[sel]) { add(hits[sel].k); e.preventDefault(); }
  else if (e.key === "Escape") drop.hidden = true;
});
drop.addEventListener("mousedown", e => { const b = e.target.closest(".opt"); if (b) { e.preventDefault(); add(b.dataset.k); } });
q.addEventListener("blur", () => setTimeout(() => drop.hidden = true, 120));
function add(k) { const ex = list.find(x => x.k === k); if (ex) ex.q++; else list.push({ k, q: 1 }); q.value = ""; drop.hidden = true; toast("Added " + BY.get(k).n); render(); q.focus(); }
const POP = ["eggs", "milk", "challah", "chicken", "salmon", "tomatoes", "grape juice", "seltzer", "foil pans", "cheese"];
$("chips").innerHTML = POP.map(w => `<button class="chip" data-w="${w}">+ ${w}</button>`).join("");
$("chips").addEventListener("click", e => { const b = e.target.closest(".chip"); if (!b) return; q.value = b.dataset.w; hits = search(q.value); sel = 0; renderDrop(); q.focus(); });
function starter() { const seen = new Set(); list = []; POP.forEach(w => { const p = search(w, 1)[0]; if (p && !seen.has(p.k)) { seen.add(p.k); list.push({ k: p.k, q: 1 }); } }); render(); }
$("starter").onclick = starter;
$("clearList").onclick = () => { list = []; render(); };

// ---------- list ----------
function renderList() {
  list = list.filter(x => BY.has(x.k));
  $("list").innerHTML = list.length ? list.map(x => { const p = BY.get(x.k); const lo = lowest(p); return `<div class="li">${thumb(p)}<span class="meta"><b>${esc(p.n)}</b><span>${esc(p.b)}${lo < Infinity ? " · best " + money(lo) : " · not sold in this area"}</span></span><span class="qty"><button data-a="dec" data-k="${esc(x.k)}" aria-label="Fewer">−</button><span class="num">${x.q}</span><button data-a="inc" data-k="${esc(x.k)}" aria-label="More">+</button></span><button class="x" data-a="rm" data-k="${esc(x.k)}" aria-label="Remove"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`; }).join("")
    : `<div class="empty">Your list is empty. Search above, or tap “Starter list”.</div>`;
  $("listCount").textContent = `${list.length} items · ${list.reduce((a, x) => a + x.q, 0)} units`;
}
$("list").addEventListener("click", e => { const b = e.target.closest("button[data-a]"); if (!b) return; const it = list.find(x => x.k === b.dataset.k); if (!it) return;
  if (b.dataset.a === "inc") it.q++; else if (b.dataset.a === "dec") { if (--it.q < 1) list = list.filter(x => x !== it); } else list = list.filter(x => x !== it); render(); });

// ---------- compare ----------
function delivery(s, sub) {
  const d = s.delivery || {};
  if (d.fee == null) return { known: false, fee: 0, free: false, gap: null };
  const free = d.freeOver != null && sub >= d.freeOver;
  return { known: true, fee: free ? 0 : d.fee, free, gap: d.freeOver != null ? Math.max(0, d.freeOver - sub) : null };
}
function compute() {
  return areaStores().map(s => {
    let sub = 0; const missing = [];
    list.forEach(x => { const o = offer(s, BY.get(x.k)); if (o) sub += o.price * x.q; else missing.push(x.k); });
    const d = delivery(s, sub);
    return { s, sub, missing, d, belowMin: s.delivery && s.delivery.minimum != null && sub < s.delivery.minimum, total: sub + d.fee };
  }).sort((a, b) => a.missing.length - b.missing.length || a.total - b.total);
}
function delivText(r) {
  const d = r.s.delivery || {};
  if (!r.d.known) return `<span>Delivery fee not listed yet</span>`;
  const pct = d.freeOver ? Math.min(100, r.sub / d.freeOver * 100) : 0;
  return `<span>${r.d.free ? `<span class="pill free">Free delivery</span> over ${money(d.freeOver)}` : `Delivery <b class="num">${money(d.fee)}</b>${d.freeOver != null ? ` · free over ${money(d.freeOver)}` : ""}`}</span>${d.freeOver != null ? `<span class="bar${r.d.free ? " full" : ""}"><i style="width:${pct}%"></i></span>${r.d.free ? "" : `<span class="num">${money(r.d.gap)} to go</span>`}` : ""}`;
}
function renderResults() {
  const AS = areaStores();
  const unl = STORES.filter(s => s.area === area && !(s.siteId && SITES[s.siteId]));
  $("unlisted").innerHTML = unl.length ? `<b>Not compared yet:</b> ${unl.map(s => esc(s.name)).join(", ")}. Their prices aren't readable from their website yet.` : "";
  if (!AS.length) { $("hero").innerHTML = `<div class="hero"><div><div class="eyebrow">Getting started</div><h1>Prices are on the way</h1><p class="sub">The price robot checks every store's website overnight. Once it has run, your comparison shows up here.</p></div></div>`; $("stores").innerHTML = ""; $("matrix").innerHTML = `<div class="empty">No prices yet for this area.</div>`; return; }
  if (!list.length) { $("hero").innerHTML = `<div class="hero"><div><div class="eyebrow">Best store</div><h1>Add items to compare</h1><p class="sub">Your cheapest store shows up here as soon as your list has something on it.</p></div></div>`; $("stores").innerHTML = ""; $("matrix").innerHTML = `<div class="empty">No items yet.</div>`; return; }
  const R = compute(), best = R[0], complete = R.filter(r => !r.missing.length);
  const worst = complete.length ? Math.max(...complete.map(r => r.total)) : best.total;
  const avg = complete.length ? complete.reduce((a, r) => a + r.total, 0) / complete.length : best.total;
  $("hero").innerHTML = `<div class="hero"><div><div class="eyebrow">Cheapest store for your list</div><h1>${esc(best.s.name)}</h1>
    <p class="sub">${best.missing.length ? `Missing ${best.missing.length} item${best.missing.length > 1 ? "s" : ""}` : "Carries every item"} · ${!best.d.known ? "delivery fee not listed" : best.d.free ? "free delivery" : "delivery " + money(best.d.fee)}${best.d.known && !best.d.free && best.d.gap != null && best.d.gap < 30 ? ` · add ${money(best.d.gap)} for free delivery` : ""}</p>
    ${worst - best.total > 0.005 ? `<span class="savepill num">Save ${money(worst - best.total)} vs. the priciest store · ${money(avg - best.total)} vs. average</span>` : ""}</div>
    <div class="right"><div class="eyebrow">Total${best.d.known ? " with delivery" : ""}</div><div class="big num">${money(best.total)}</div><button class="btn light" data-shop="${best.s.id}">Add list to ${esc(best.s.name)} cart</button></div></div>`;
  $("stores").innerHTML = R.map((r, i) => { const d = r.total - best.total;
    const site = SITES[r.s.siteId], old = (Date.now() - new Date(site.checkedAt)) / 36e5 > 48;
    return `<div class="srow${i === 0 ? " best" : ""}"><span class="rank num">${i + 1}</span>
    <span class="nm"><b>${esc(r.s.name)}</b><span>${esc(r.s.address)} · <span class="${old ? "stale" : ""}">checked ${ago(site.checkedAt)}</span>${r.missing.length ? ` · <span class="pill miss">${r.missing.length} not carried</span>` : ""}${r.belowMin ? ` · <span class="pill min">below ${money(r.s.delivery.minimum)} minimum</span>` : ""}</span></span>
    <span class="deliv">${delivText(r)}</span>
    <span class="tot num"><b>${money(r.total)}</b><span class="delta${Math.abs(d) < 0.005 ? " zero" : ""}">${Math.abs(d) < 0.005 ? "Lowest" : d > 0 ? "+" + money(d) : money(-d) + " less, but missing items"}</span></span>
    <span class="act"><button class="btn ${i === 0 ? "primary" : "ghost"} sm" data-shop="${r.s.id}">Shop here</button></span></div>`; }).join("");
  const tot = {}; AS.forEach(s => tot[s.id] = 0);
  const rows = list.map(x => { const p = BY.get(x.k), lo = lowest(p);
    return `<tr><td>${esc(p.n)} <span class="hint">×${x.q}</span></td>${AS.map(s => { const o = offer(s, p); if (!o) return `<td class="na">n/a</td>`; tot[s.id] += o.price * x.q; return `<td class="${o.price === lo ? "low" : ""}"><button class="cell" data-cell="${s.id}|${esc(x.k)}" title="Add to ${esc(s.name)} cart">${money(o.price)}</button></td>`; }).join("")}</tr>`; }).join("");
  $("matrix").innerHTML = `<table><thead><tr><th>Item</th>${AS.map(s => `<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody><tfoot><tr><td>Subtotal (before delivery)</td>${AS.map(s => `<td class="num">${money(tot[s.id])}</td>`).join("")}</tr></tfoot></table>`;
}

// ---------- cart & checkout on the store's own site ----------
const S = id => STORES.find(s => s.id === id);
document.addEventListener("click", e => {
  const b = e.target.closest("[data-shop]");
  if (b) { const s = S(b.dataset.shop); let n = 0; cart[s.id] = cart[s.id] || {}; list.forEach(x => { if (offer(s, BY.get(x.k))) { cart[s.id][x.k] = (cart[s.id][x.k] || 0) + x.q; n++; } }); renderCart(); openCart(); toast(`Added ${n} items to ${s.name} cart`); return; }
  const c = e.target.closest("[data-cell]");
  if (c) { const i = c.dataset.cell.indexOf("|"), sid = c.dataset.cell.slice(0, i), k = c.dataset.cell.slice(i + 1); const qn = (list.find(x => x.k === k) || { q: 1 }).q; cart[sid] = cart[sid] || {}; cart[sid][k] = (cart[sid][k] || 0) + qn; renderCart(); toast(`${BY.get(k).n} added to ${S(sid).name} cart`); }
});
function renderCart() {
  Object.keys(cart).forEach(id => { if (!S(id)) { delete cart[id]; return; } Object.keys(cart[id]).forEach(k => { if (!BY.has(k)) delete cart[id][k]; }); if (!Object.keys(cart[id]).length) delete cart[id]; });
  $("cartCount").textContent = Object.values(cart).reduce((a, o) => a + Object.values(o).reduce((x, y) => x + y, 0), 0);
  const ids = Object.keys(cart);
  $("cartBody").innerHTML = ids.length ? ids.map(id => {
    const s = S(id), site = SITES[s.siteId]; let sub = 0;
    const lines = Object.entries(cart[id]).map(([k, qn]) => { const p = BY.get(k), o = offer(s, p); if (!o) return { p, qn, o: null }; sub += o.price * qn; return { p, qn, o }; });
    const d = delivery(s, sub);
    const okLines = lines.filter(l => l.o);
    const canCartLink = site.checkout === "shopify-cart" && okLines.every(l => l.o.variant);
    const cartUrl = canCartLink ? `${site.origin}/cart/${okLines.map(l => l.o.variant + ":" + l.qn).join(",")}` : site.origin;
    return `<div class="cgroup"><h3><span>${esc(s.name)}</span><button class="link" data-clear="${id}">Empty</button></h3>
      ${lines.map(l => `<div class="cline"><span>${esc(l.p.n)} <span class="hint">×${l.qn}</span></span><span class="num">${l.o ? money(l.o.price * l.qn) : "unavailable"}</span></div>`).join("")}
      <div class="csum num"><span>Subtotal</span><span>${money(sub)}</span><span>Delivery</span><span>${d.known ? (d.fee ? money(d.fee) : "Free") : "set by store"}</span><span class="t">Estimated total</span><span class="t">${money(sub + d.fee)}</span></div>
      <a class="btn primary" href="${esc(cartUrl)}" target="_blank" rel="noopener">${canCartLink ? "Check out at " + esc(s.name) : "Open " + esc(s.name) + " to order"}</a>
      ${canCartLink ? `<p class="hint" style="margin:8px 0 0">Your items load into ${esc(s.name)}'s cart. You pay on their website.</p>`
        : `<p class="hint" style="margin:8px 0 0">${esc(s.name)}'s website doesn't accept a ready-made cart, so open each item and add it there:</p><div class="handoff">${okLines.map(l => `<a href="${esc(l.o.url)}" target="_blank" rel="noopener">${esc(l.p.n)} ×${l.qn} →</a>`).join("")}</div>`}
    </div>`; }).join("") : `<div class="empty">Your carts are empty. Pick a store from the comparison and tap “Shop here”.</div>`;
  save();
}
const openCart = () => { $("drawer").hidden = false; $("scrim").hidden = false; };
const closeCart = () => { $("drawer").hidden = true; $("scrim").hidden = true; };
$("openCart").onclick = openCart; $("closeCart").onclick = closeCart; $("scrim").onclick = closeCart;
document.addEventListener("keydown", e => { if (e.key === "Escape") closeCart(); });
$("cartBody").addEventListener("click", e => { const cl = e.target.closest("[data-clear]"); if (cl) { delete cart[cl.dataset.clear]; renderCart(); } });

// ---------- boot ----------
function render() { renderList(); renderResults(); save(); }
function renderFreshness() {
  const AS = areaStores(); const all = STORES.filter(s => s.area === area);
  const newest = AS.map(s => SITES[s.siteId].checkedAt).sort().pop();
  $("freshness").innerHTML = AS.length ? `Comparing <b>${AS.length}</b> of ${all.length} stores in ${esc(AREAS.find(a => a.id === area).name)} · prices last checked ${ago(newest)}. Prices come from each store's website and may differ in store.` : `No prices collected yet for ${esc((AREAS.find(a => a.id === area) || {}).name || "this area")}.`;
}
$("area").addEventListener("change", e => { area = e.target.value; renderFreshness(); render(); });
Promise.all([fetch("data/stores.json").then(r => r.json()), fetch("data/catalog.json").then(r => r.json())]).then(([st, cat]) => {
  STORES = st.stores; SITES = st.sites || {}; AREAS = st.areas; CAT = cat.products || []; CAT.forEach(p => BY.set(p.k, p));
  if (!AREAS.some(a => a.id === area)) area = AREAS[0].id;
  $("area").innerHTML = AREAS.map(a => `<option value="${a.id}"${a.id === area ? " selected" : ""}>${esc(a.name)}</option>`).join("");
  renderFreshness();
  if (!list.length && !store.get("cc-seen", false) && CAT.length) { store.set("cc-seen", true); starter(); } else render();
  renderCart();
}).catch(() => { $("freshness").textContent = "Prices couldn't load. Refresh the page to try again."; $("hero").innerHTML = ""; });
})();
