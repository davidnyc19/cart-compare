# Cart Compare

Kosher grocery price comparison for Lakewood, NJ and nearby areas. Shoppers build a list, see which store is cheapest including delivery, and check out on that store's own website.

## How it works

1. **Price robot** (`scraper/`) runs every night. It visits each store's website, reads the product prices, and saves them in `site/data/`. It checks each store's `robots.txt` rules first, waits between page visits, and skips any page the store has marked off-limits.
2. **Website** (`site/`) reads those saved prices. It's a plain website with no server or database needed.
3. **GitHub** runs the robot every night and hosts the website for free (`.github/workflows/nightly.yml`).

## Going live (one-time)

1. Create a free account at github.com.
2. Create a new repository named `cart-compare` and upload everything in this folder.
3. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Go to **Actions → Nightly prices → Run workflow** to collect prices for the first time.
5. Your site is published at `https://YOUR-USERNAME.github.io/cart-compare/`.

## Adding or editing stores

Everything about stores lives in `stores.json`:

- **Add a store:** copy an existing entry and change its name, address, zip and website.
- **Add a new area:** add it under `areas` with its zip codes, then set `"area"` on that area's stores.
- **Delivery fees:** fill in `fee`, `freeOver` (the free-delivery threshold) and `minimum`, in dollars. Until those are filled in, the site shows "Delivery fee not listed yet".
- **Turn a store off:** set `"adapter": "off"`.

## What to expect from each store

The robot handles two common kinds of store website on its own:

- **Shopify stores:** reads the full catalog. Checkout sends the shopper to the store with their cart already filled in.
- **Stores with a product sitemap:** reads each product page. Checkout gives the shopper a link to each item on the store's website.

If a store's website is built differently, sells only through an app or Instacart, or refuses automated visitors, it shows on the site as "Not compared yet". Its error is saved in `site/data/status.json`, and that store needs its own custom adapter. Store websites change, so check `status.json` every so often.

## Testing

Run `npm install`, then `npm test`. The test starts two fake stores on your computer, runs the real robot against them, and checks the results.
