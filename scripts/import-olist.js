// Converts the Kaggle "Brazilian E-Commerce Public Dataset by Olist" into PowerPulse's data shape,
// for ONE seller (the busiest by default), so it behaves like a single small store.
// Usage: node scripts/import-olist.js <folder-with-csvs> [--seller=<seller_id>] [--days=90]
import fs from 'node:fs';
import path from 'node:path';

const [folder, ...rest] = process.argv.slice(2);
if (!folder) { console.error('Usage: node scripts/import-olist.js <folder-with-csvs> [--seller=ID] [--days=90]'); process.exit(1); }
const opt = Object.fromEntries(rest.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const DAYS = Number(opt.days || 90);

// Minimal RFC-4180 CSV parser (handles quoted commas, quotes and newlines).
function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h.replace(/^\uFEFF/, ''), r[i]])));
}
const read = (name, optional = false) => {
  const p = path.join(folder, name);
  if (!fs.existsSync(p)) { if (optional) return []; console.error(`Missing file: ${p}`); process.exit(1); }
  return parseCSV(fs.readFileSync(p, 'utf8'));
};

const ordersRaw = read('olist_orders_dataset.csv');
const itemsRaw = read('olist_order_items_dataset.csv');
const productsRaw = read('olist_products_dataset.csv');
const payRaw = read('olist_order_payments_dataset.csv', true);
const trans = Object.fromEntries(read('product_category_name_translation.csv', true).map((r) => [r.product_category_name, r.product_category_name_english]));

// Pick the seller with the most distinct orders unless one was given.
let seller = opt.seller;
if (!seller) {
  const bySeller = new Map();
  for (const it of itemsRaw) { (bySeller.get(it.seller_id) ?? bySeller.set(it.seller_id, new Set()).get(it.seller_id)).add(it.order_id); }
  seller = [...bySeller.entries()].sort((a, b) => b[1].size - a[1].size)[0][0];
}
const myItems = itemsRaw.filter((i) => i.seller_id === seller);
const orderMeta = new Map(ordersRaw.map((o) => [o.order_id, o]));
const catOf = new Map(productsRaw.map((p) => [p.product_id, p.product_category_name]));
const STATUS = { delivered: 'delivered', shipped: 'shipped', approved: 'paid', invoiced: 'paid', processing: 'paid', created: 'pending', canceled: 'canceled', unavailable: 'canceled' };

// Group item rows (one row per unit) into order lines.
const byOrder = new Map();
for (const it of myItems) {
  if (!orderMeta.has(it.order_id)) continue;
  const lines = byOrder.get(it.order_id) ?? new Map();
  const l = lines.get(it.product_id) ?? { productId: it.product_id, qty: 0, price: Number(it.price) };
  l.qty++; lines.set(it.product_id, l); byOrder.set(it.order_id, lines);
}
let orders = [...byOrder].map(([id, lines]) => {
  const m = orderMeta.get(id);
  return { id, customer: 'Customer', placedAt: new Date(m.order_purchase_timestamp.replace(' ', 'T') + 'Z'), status: STATUS[m.order_status] || 'paid', items: [...lines.values()] };
}).filter((o) => !isNaN(o.placedAt));
if (!orders.length) { console.error('No orders found for that seller.'); process.exit(1); }

const latest = Math.max(...orders.map((o) => o.placedAt.getTime()));
orders = orders.filter((o) => o.placedAt.getTime() >= latest - DAYS * 86400000).sort((a, b) => a.placedAt - b.placedAt);

// Products seen in the kept orders. Olist has NO product names and NO stock levels:
// names are "<category> #<id>", and stock is SYNTHETIC (seeded, derived from sales velocity).
let seed = 42; const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const sold = new Map(), price = new Map();
for (const o of orders) for (const l of o.items) { sold.set(l.productId, (sold.get(l.productId) || 0) + l.qty); price.set(l.productId, l.price); }
const products = [...sold].map(([id, units]) => {
  const raw = catOf.get(id) || 'uncategorized';
  const perDay = units / DAYS;
  const reorderLevel = Math.max(2, Math.ceil(perDay * 7));
  const cover = 2 + rnd() * 40; // days of cover, 2..42
  return { id, name: `${(trans[raw] || raw).replace(/_/g, ' ')} #${id.slice(0, 4)}`, category: trans[raw] || raw, price: price.get(id), stock: Math.max(0, Math.round(perDay * cover)), reorderLevel };
});
const payments = orders.map((o) => ({ orderId: o.id, at: o.placedAt, status: 'success', method: 'unknown' }));

const out = {
  meta: { source: 'Olist Brazilian E-Commerce Public Dataset (Kaggle)', sellerId: seller, days: DAYS, latestOrderAt: new Date(latest).toISOString(), syntheticStock: true, hasFailedPayments: false, hasCarts: false },
  products, orders, payments, carts: [],
  policy: { returnWindowDays: 7, refundDays: '5-7 business days after the item is received back', shippingDays: '3-5 business days' },
};
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/olist-store.json', JSON.stringify(out));
console.log(`Seller ${seller}: ${orders.length} orders, ${products.length} products (last ${DAYS} days). Wrote data/olist-store.json`);
