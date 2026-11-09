// The "Fill my cart" bookmark. Runs on the store's own website, signed in as the shopper,
// and asks the store to add every item Cart Compare put in the address (#cartcompare=storeId,product:qty,...).
(async () => {
  const say = m => alert("Cart Compare: " + m);
  try {
    const m = decodeURIComponent(location.hash).match(/cartcompare=([\d:,]+)/);
    if (!m) { say("open this store from the Cart Compare site first (tap “Open store” there), then tap this bookmark."); return; }
    const [sid, ...parts] = m[1].split(",");
    const items = parts.map(x => { const [a, b] = x.split(":"); return { storeProductId: +a, qty: +b || 1, byCase: false, attr: "" }; });
    let last = "";
    for (const ct of ["application/json", "application/x-www-form-urlencoded; charset=UTF-8"]) {
      const r = await fetch("/proxy-api/ClientShoppingCart/AddStoreProductsToCart", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": ct, "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ storeId: +sid, items })
      });
      if (r.status === 401 || r.status === 403) { say("please sign in to this store first, then tap the bookmark again."); return; }
      const j = await r.json().catch(() => null);
      const d = j && (j.data || j);
      if (r.ok && d && d.success !== false) {
        const failed = typeof d.failedCount === "number" ? d.failedCount : 0;
        if (failed < items.length) {
          say(`added ${items.length - failed} of ${items.length} items to your cart.` + (failed ? " Some items are out of stock or unavailable right now." : ""));
          history.replaceState(null, "", location.pathname);
          location.reload();
          return;
        }
      }
      last = (d && (d.message || d.Message)) || ("status " + r.status);
    }
    say("the store didn't accept the items (" + last + "). Make sure you're signed in, or add them one by one from Cart Compare.");
  } catch (e) { say("something went wrong: " + e.message); }
})();
