(function () {
"use strict";
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

const CATS = [["Eggs", "eggs", "eggs"], ["Milk", "milk", "dairy"], ["Challah", "challah", "bakery"], ["Chicken", "chicken", "meat"], ["Fish", "salmon", "fish"], ["Fruits & Veg", "@produce", "produce"], ["Drinks", "@drinks", "drinks"], ["Paper goods", "@household", "household"]];

let STORES = [], SITES = {}, AREAS = [], CAT = [], BY = new Map();
let area = mem.get("cc-area", null), list = mem.get("cc-list", []);
const save = () => { mem.set("cc-list", list); mem.set("cc-area", area); };
const here = () => STORES.filter(s => s.area === area && s.siteId && SITES[s.siteId]);
const offer = (s, p) => { const o = p && p.o[s.siteId]; return o && o[3] !== 0 ? { price: o[0], url: o[1], variant: o[2] } : null; };
const lowest = p => Math.min(...here().map(s => (offer(s, p) || { price: Infinity }).price));
const stores = p => here().filter(s => offer(s, p)).length;
function toast(m) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 1800); }

// ---------- finding items ----------
const q = $("q"), drop = $("drop"); let hits = [], sel = 0;
const stem = w => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
function find(term, n = 8) {
  let r;
  if (term.startsWith("@")) r = CAT.filter(p => p.c === term.slice(1));
  else {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean).map(stem); if (!words.length) return [];
    r = CAT.filter(p => { const h = (p.n + " " + p.b).toLowerCase(); return words.every(w => h.includes(w)); });
  }
  return r.map(p => [p, stores(p)]).filter(x => x[1]).sort((a, b) => b[1] - a[1] || a[0].n.length - b[0].n.length).slice(0, n).map(x => x[0]);
}
function showDrop() {
  drop.innerHTML = hits.length ? hits.map((p, i) => `<button class="opt${i === sel ? " on" : ""}" data-k="${esc(p.k)}">${pic(p)}<span><b>${esc(p.n)}</b><small>from ${money(lowest(p))}</small></span><span class="plus" aria-hidden="true">+</span></button>`).join("")
    : `<div class="none">We couldn't find that yet. Try a shorter word, like “milk”.</div>`;
  drop.hidden = false;
}
q.addEventListener("input", () => { hits = find(q.value); sel = 0; q.value.trim() ? showDrop() : drop.hidden = true; });
q.addEventListener("keydown", e => {
  if (e.key === "ArrowDown") { sel = Math.min(sel + 1, hits.length - 1); showDrop(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { sel = Math.max(sel - 1, 0); showDrop(); e.preventDefault(); }
  else if (e.key === "Enter" && hits[sel]) { add(hits[sel].k); e.preventDefault(); }
  else if (e.key === "Escape") drop.hidden = true;
});
drop.addEventListener("mousedown", e => { const b = e.target.closest(".opt"); if (b) { e.preventDefault(); add(b.dataset.k); } });
q.addEventListener("blur", () => setTimeout(() => drop.hidden = true, 150));
$("cats").innerHTML = CATS.map(([l, t, c]) => `<button class="cat" data-t="${t}"><span class="ic" style="${tint(c)}">${svg(c, 24)}</span>${l}</button>`).join("");
$("cats").addEventListener("click", e => { const b = e.target.closest(".cat"); if (!b) return; hits = find(b.dataset.t); sel = 0; q.value = b.dataset.t.startsWith("@") ? "" : b.dataset.t; showDrop(); q.focus(); });
function add(k) { const x = list.find(i => i.k === k); x ? x.q++ : list.push({ k, q: 1 }); q.value = ""; drop.hidden = true; toast("Added ✓"); render(); }

// ---------- list ----------
function showList() {
  list = list.filter(x => BY.has(x.k));
  $("count").textContent = list.length ? list.length + (list.length === 1 ? " item" : " items") : "";
  $("count").hidden = !list.length;
  $("list").innerHTML = list.length ? list.map(x => { const p = BY.get(x.k); return `<div class="row">${pic(p)}<span class="name">${esc(p.n)}</span><span class="qty"><button data-a="-" data-k="${esc(x.k)}" aria-label="One less">−</button><span class="num">${x.q}</span><button data-a="+" data-k="${esc(x.k)}" aria-label="One more">+</button></span></div>`; }).join("") + `<p style="margin:12px 0 0"><button class="link" id="clear">Start a new list</button></p>`
    : `<p class="empty">Nothing yet. Tap a picture above or type what you need.</p>`;
  const c = $("clear"); if (c) c.onclick = () => { list = []; render(); };
}
$("list").addEventListener("click", e => { const b = e.target.closest("button[data-a]"); if (!b) return; const x = list.find(i => i.k === b.dataset.k); if (!x) return; x.q += b.dataset.a === "+" ? 1 : -1; if (x.q < 1) list = list.filter(i => i !== x); render(); });

// ---------- the answer ----------
function totals() {
  return here().map(s => {
    let sub = 0; const miss = [];
    list.forEach(x => { const o = offer(s, BY.get(x.k)); o ? sub += o.price * x.q : miss.push(x.k); });
    const d = s.delivery || {}; const known = d.fee != null;
    const fee = known ? (d.freeOver != null && sub >= d.freeOver ? 0 : d.fee) : 0;
    return { s, sub, miss, known, fee, total: sub + fee, gap: d.freeOver != null ? d.freeOver - sub : null };
  }).sort((a, b) => a.miss.length - b.miss.length || a.total - b.total);
}
function showAnswer() {
  const A = $("answer"), bar = $("bar");
  bar.hidden = true;
  if (!here().length) { A.innerHTML = `<div class="card"><h2>Prices are coming soon</h2><p class="empty">We're collecting prices from the stores in this area. Check back shortly.</p></div>`; return; }
  if (!list.length) { A.innerHTML = ""; return; }
  const R = totals(), w = R[0], full = R.filter(r => !r.miss.length);
  const save = full.length > 1 ? Math.max(...full.map(r => r.total)) - w.total : 0;
  const deliv = !w.known ? "plus delivery" : w.fee ? `includes ${money(w.fee)} delivery` : "free delivery";
  A.innerHTML = `<div class="win"><div class="lbl">Cheapest store for your list</div><h2>${esc(w.s.name)}</h2>
    <div class="total num">${money(w.total)} <small>${deliv}</small></div>
    ${save > 0.005 ? `<span class="save num">You save ${money(save)}</span>` : ""}
    ${w.miss.length ? `<p class="note">Doesn't carry ${w.miss.length} of your items.</p>` : ""}
    ${w.known && w.fee && w.gap > 0 && w.gap < 25 ? `<p class="note">Add ${money(w.gap)} more for free delivery.</p>` : ""}
    <button class="big" data-shop="${w.s.id}">Shop at ${esc(w.s.name)}</button></div>
  <details class="more"><summary>Compare all ${R.length} stores</summary>${R.map((r, i) => `<div class="store"><span class="n"><b>${esc(r.s.name)}</b><small>${esc(r.s.address)}</small></span><span class="t num">${money(r.total)}<small class="${i === 0 ? "ok" : ""}">${i === 0 ? "Cheapest" : r.miss.length ? r.miss.length + " missing" : "+" + money(r.total - w.total)}</small></span><button data-shop="${r.s.id}">Shop</button></div>`).join("")}</details>
  <details class="more"><summary>See every price</summary><div class="tablewrap"><table><thead><tr><th>Item</th>${here().map(s => `<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody>${list.map(x => { const p = BY.get(x.k), lo = lowest(p); return `<tr><td>${esc(p.n)}${x.q > 1 ? " ×" + x.q : ""}</td>${here().map(s => { const o = offer(s, p); return o ? `<td class="${o.price === lo ? "low" : ""}">${money(o.price)}</td>` : `<td class="na">–</td>`; }).join("")}</tr>`; }).join("")}</tbody></table></div></details>`;
  bar.innerHTML = `<div class="in"><div><small>Cheapest</small><b>${esc(w.s.name)} · <span class="num">${money(w.total)}</span></b></div><button data-shop="${w.s.id}">Shop now</button></div>`;
  bar.hidden = false;
}

// ---------- shop on the store's website ----------
document.addEventListener("click", e => {
  const b = e.target.closest("[data-shop]"); if (!b) return;
  const s = STORES.find(x => x.id === b.dataset.shop), site = SITES[s.siteId];
  const have = [], miss = [];
  list.forEach(x => { const p = BY.get(x.k), o = offer(s, p); o ? have.push({ p, q: x.q, o }) : miss.push(p); });
  const oneClick = site.checkout === "shopify-cart" && have.length && have.every(h => h.o.variant);
  const url = oneClick ? `${site.origin}/cart/${have.map(h => h.o.variant + ":" + h.q).join(",")}` : site.origin;
  $("sheet").innerHTML = `<button class="close" id="x" aria-label="Close">✕</button><h2>Shop at ${esc(s.name)}</h2>
    ${oneClick ? `<p>Tap below. Your ${have.length} items go straight into ${esc(s.name)}'s cart, and you pay on their website.</p><a class="big solid" href="${esc(url)}" target="_blank" rel="noopener">Go to ${esc(s.name)} checkout</a>`
      : `<p>Tap each item to add it on ${esc(s.name)}'s website, then check out there.</p><div class="items">${have.map(h => `<a href="${esc(h.o.url || site.origin)}" target="_blank" rel="noopener"><span>${esc(h.p.n)}${h.q > 1 ? " ×" + h.q : ""}</span><span>Open →</span></a>`).join("")}</div><a class="big solid" href="${esc(site.origin)}" target="_blank" rel="noopener">Open ${esc(s.name)} website</a>`}
    ${miss.length ? `<p style="margin-top:16px">Not sold here: ${miss.map(p => esc(p.n)).join(", ")}</p>` : ""}`;
  $("modal").hidden = false; $("x").onclick = () => $("modal").hidden = true;
});
$("modal").addEventListener("click", e => { if (e.target.id === "modal") $("modal").hidden = true; });
document.addEventListener("keydown", e => { if (e.key === "Escape") $("modal").hidden = true; });

// ---------- start ----------
function render() { showList(); showAnswer(); save(); $("intro").hidden = list.length > 0; }
$("area").addEventListener("change", e => { area = e.target.value; render(); });
Promise.all([fetch("data/stores.json").then(r => r.json()), fetch("data/catalog.json").then(r => r.json())]).then(([st, cat]) => {
  STORES = st.stores; SITES = st.sites || {}; AREAS = st.areas; CAT = cat.products || []; CAT.forEach(p => BY.set(p.k, p));
  if (!AREAS.some(a => a.id === area)) area = AREAS[0].id;
  $("area").innerHTML = AREAS.map(a => `<option value="${a.id}"${a.id === area ? " selected" : ""}>${esc(a.name.replace(", NJ", ""))}</option>`).join("");
  render();
}).catch(() => { $("answer").innerHTML = `<div class="card"><h2>Something didn't load</h2><p class="empty">Please refresh the page.</p></div>`; });
})();
