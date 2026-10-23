// Evaluation harness: each case asks a seller question and checks the computed answer against known ground truth.
// Run with:  npm test      (extend the cases list toward ~50 questions for your interview story)
import * as A from '../src/analytics.js';
import * as sample from '../src/data/sample.js';
import { generate } from '../src/seed/generate.js';
import { normalizeOrder, normalizeProduct, normalizeStatus } from '../src/data/mongoMap.js';
import { loadFromDb } from '../src/data/mongoAdapter.js';

const data = { ...sample };

const cases = [
  { q: 'How many orders in the last 24 hours?', run: () => A.recentOrders(data, 24).orderCount, expect: (v) => v === 3 || v === 4 },
  { q: 'Which product is most urgent to restock?', run: () => A.lowStock(data)[0]?.name, expect: (v) => ['Impact Driver Kit', 'Cordless Drill 18V'].includes(v) },
  { q: 'How many products are low on stock?', run: () => A.lowStock(data).length, expect: (v) => v === 2 },
  { q: 'Did revenue fall this week?', run: () => A.salesDrop(data, 7).revenueChangePct, expect: (v) => v !== null && v < 0 },
  { q: 'Which category dropped the most?', run: () => A.salesDrop(data, 7).categoryChanges[0].category, expect: (v) => v === 'Drills' },
  { q: 'Is a stock issue named as a driver for Drills?', run: () => JSON.stringify(A.salesDrop(data, 7).causes.find((c) => c.category === 'Drills')), expect: (v) => /reorder level/.test(v) },
  { q: 'Are failed payments counted?', run: () => A.salesDrop(data, 7).failedPayments, expect: (v) => v >= 4 },
  { q: 'How many carts idle for 1+ hour?', run: () => A.abandonedCarts(data, 1).length, expect: (v) => v === 4 },
  { q: 'How many carts idle for 24+ hours?', run: () => A.abandonedCarts(data, 24).length, expect: (v) => v === 3 },
  { q: 'Highest-value abandoned cart?', run: () => A.abandonedCarts(data, 1)[0].customer, expect: (v) => v === 'Kavya' },
  { q: 'Reply for unknown order is rejected', run: () => A.replyFacts(data, 'O9999', 'delay').found, expect: (v) => v === false },
  { q: 'Refund reply states the real policy window', run: () => A.draftFromFacts(A.replyFacts(data, 'O1012', 'refund_request')), expect: (v) => v.includes('7 days') && v.includes('O1012') },
];

// Canceled orders must not count as revenue.
const withCanceled = { ...data, orders: [...data.orders, { id: 'OX', customer: 'T', placedAt: new Date(), status: 'canceled', items: [{ productId: 'P1', qty: 5, price: 4499 }] }] };
cases.push({ q: 'Canceled order is excluded from revenue', run: () => A.recentOrders(withCanceled, 24).revenue, expect: (v) => v === A.recentOrders(data, 24).revenue });

// --- MongoDB mapping: typical MERN-shop document shapes ---
cases.push(
  { q: 'Maps title/countInStock/category object', run: () => normalizeProduct({ _id: 'a1', title: 'Drill', countInStock: 3, price: '4499', category: { name: 'Drills' } }), expect: (v) => v.name === 'Drill' && v.stock === 3 && v.price === 4499 && v.category === 'Drills' },
  { q: 'Product without a stock field gets stock null', run: () => normalizeProduct({ _id: 'a2', name: 'Saw', price: 10 }).stock, expect: (v) => v === null },
  { q: 'isPaid/isDelivered booleans map to a status', run: () => [normalizeStatus({ isDelivered: true }), normalizeStatus({ isPaid: true }), normalizeStatus({})].join(), expect: (v) => v === 'delivered,paid,pending' },
  { q: 'Cancelled spelling maps to canceled', run: () => normalizeStatus({ status: 'Cancelled' }), expect: (v) => v === 'canceled' },
  { q: 'Order maps orderItems, qty, product ref and first name only', run: () => normalizeOrder({ _id: 'o1', createdAt: '2026-10-01', orderItems: [{ product: 'p1', qty: 2, price: 100, name: 'X' }], user: { name: 'Rohit Mudgal' } }), expect: (v) => v.items[0].productId === 'p1' && v.items[0].qty === 2 && v.customer === 'Rohit' },
);
// --- Demo generator: the built-in story must be discoverable by the analytics ---
const realish = Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, name: `Tool ${i}`, category: ['Drills', 'Saws', 'Grinders', 'Accessories'][i % 4], price: 500 + i * 50, stock: null, reorderLevel: 5 }));
const g = generate({ products: realish, now: Date.now(), seed: 7, storyCategory: 'Drills' });
const gd = { products: g.products.map((p) => ({ id: p._id, ...p })), orders: g.orders.map((o) => normalizeOrder(o)), payments: g.payments.map((p) => ({ ...p, productId: p.productId, at: p.createdAt })), carts: [], policy: data.policy };
cases.push(
  { q: 'Demo story: Drills revenue falls', run: () => A.salesDrop(gd, 7).categoryChanges[0].category, expect: (v) => v === 'Drills' },
  { q: 'Demo story: low stock explains the drop', run: () => JSON.stringify(A.salesDrop(gd, 7).causes.find((c) => c.category === 'Drills')), expect: (v) => /reorder level/.test(v) && /failed payment/.test(v) },
  { q: 'Demo data is labeled synthetic', run: () => g.orders.every((o) => o.isDemo) && g.products.every((p) => p.isDemo), expect: (v) => v === true },
);
// --- Adapter against a fake database object ---
const fakeDocs = {
  products: [{ _id: 'p1', title: 'Drill', countInStock: 2, price: 100, category: 'Drills' }],
  orders: [{ _id: 'o1', createdAt: new Date(), isPaid: true, orderItems: [{ product: 'p1', qty: 1, price: 100 }] }],
  carts: [],
  payments: [{ _id: 'x', productId: 'p1', status: 'failed', createdAt: new Date() }],
};
const fakeDb = { collection: (name) => ({ find: () => ({ toArray: async () => fakeDocs[name] }) }) };
const loaded = await loadFromDb(fakeDb);
cases.push({ q: 'Adapter loads and normalizes all four collections', run: () => loaded, expect: (v) => v.products[0].stock === 2 && v.orders[0].status === 'paid' && v.payments[0].status === 'failed' });

cases.push({ q: 'Latest orders are newest first', run: () => A.listOrders(data, 3).map((o) => o.id).join(), expect: (v) => v.startsWith('O1016') });

let pass = 0;
for (const c of cases) {
  let got, ok = false;
  try { got = c.run(); ok = c.expect(got); } catch (e) { got = `ERROR ${e.message}`; }
  if (ok) pass++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.q}  ->  ${typeof got === 'string' && got.length > 60 ? got.slice(0, 60) + '…' : got}`);
}
console.log(`\n${pass}/${cases.length} passed (${Math.round((pass / cases.length) * 100)}%)`);
process.exit(pass === cases.length ? 0 : 1);
