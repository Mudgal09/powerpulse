// Generates clearly SYNTHETIC demo orders, failed payments and carts from your REAL products.
// Built-in story: in the last 7 days the best-selling products of one category run low and payments on them fail,
// so "why did sales drop?" has a true, explainable answer. Deterministic for a given seed.
const DAY = 86400000;
const NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Rohan', 'Karan', 'Neha', 'Priya', 'Anjali', 'Sneha', 'Pooja', 'Rahul', 'Amit', 'Sana', 'Kavya', 'Isha', 'Manoj', 'Ritu', 'Deepak', 'Meena', 'Arjun'];

export function generate({ products, days = 60, now = Date.now(), seed = 7, storyCategory } = {}) {
  let s = seed >>> 0;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pickOne = (a) => a[Math.floor(rnd() * a.length)];

  const sellable = products.filter((p) => p.price > 0);
  if (sellable.length < 5) throw new Error('Need at least 5 products with a price to generate demo data');

  // Story: the most populated category (or the one requested); its two highest-priced products become top sellers
  // that run out and suffer payment failures in the last 7 days.
  const counts = {};
  for (const p of sellable) counts[p.category] = (counts[p.category] || 0) + 1;
  const category = storyCategory && counts[storyCategory] ? storyCategory : Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const storyProducts = sellable.filter((p) => p.category === category).sort((a, b) => b.price - a.price).slice(0, 2);
  const storyIds = new Set(storyProducts.map((p) => p.id));
  const others = sellable.filter((p) => !storyIds.has(p.id));

  // Popularity: Zipf-like weights over a random ranking, with the story products ranked first and second.
  const ranked = [...storyProducts, ...others.sort(() => rnd() - 0.5)];
  const weight = new Map(ranked.map((p, i) => [p.id, 1 / Math.pow(i + 1, 0.8)]));
  const draw = (pool) => {
    const t = pool.reduce((a, p) => a + weight.get(p.id), 0); let r = rnd() * t;
    for (const p of pool) { r -= weight.get(p.id); if (r <= 0) return p; }
    return pool[pool.length - 1];
  };

  const orders = []; const payments = []; let n = 0;
  for (let d = days - 1; d >= 0; d--) {
    const count = 5 + Math.floor(rnd() * 7);
    for (let i = 0; i < count; i++) {
      const ts = now - (d + rnd()) * DAY;
      const age = (now - ts) / DAY;
      const items = new Map();
      for (let k = 0, lines = 1 + Math.floor(rnd() * 3); k < lines; k++) {
        let p = draw(sellable);
        if (d < 7 && storyIds.has(p.id) && rnd() < 0.97) p = draw(others); // story products barely sell this week
        const l = items.get(p.id) || { productId: p.id, qty: 0, price: p.price };
        l.qty += rnd() < 0.8 ? 1 : 2; items.set(p.id, l);
      }
      let status;
      if (age < 1) status = rnd() < 0.55 ? 'pending' : 'paid';
      else if (age < 3) status = rnd() < 0.3 ? 'paid' : 'shipped';
      else status = rnd() < 0.03 ? 'canceled' : 'delivered';
      orders.push({ _id: `DEMO-O${String(++n).padStart(5, '0')}`, customerName: pickOne(NAMES), createdAt: new Date(ts), status, items: [...items.values()], isDemo: true });
    }
    if (d < 7) for (const p of storyProducts) for (let f = 0, k = 1 + Math.floor(rnd() * 2); f < k; f++) {
      payments.push({ _id: `DEMO-P${String(payments.length + 1).padStart(5, '0')}`, orderId: null, productId: p.id, createdAt: new Date(now - (d + rnd()) * DAY), status: 'failed', reason: rnd() < 0.7 ? 'upi_timeout' : 'bank_declined', isDemo: true });
    }
    if (rnd() < 0.04) { const p = pickOne(sellable); payments.push({ _id: `DEMO-P${String(payments.length + 1).padStart(5, '0')}`, orderId: null, productId: p.id, createdAt: new Date(now - (d + rnd()) * DAY), status: 'failed', reason: 'bank_declined', isDemo: true }); }
  }

  const carts = Array.from({ length: 12 }, (_, i) => {
    const lines = new Map();
    for (let k = 0, m = 1 + Math.floor(rnd() * 3); k < m; k++) { const p = draw(sellable); lines.set(p.id, { productId: p.id, qty: 1, price: p.price }); }
    return { _id: `DEMO-C${i + 1}`, customerName: pickOne(NAMES), updatedAt: new Date(now - (1 + rnd() * 70) * 3600000), items: [...lines.values()], isDemo: true };
  });

  // Stock from baseline sales speed (days 7+). Story products end up below reorder level; a couple of others too.
  const base = new Map();
  for (const o of orders) if (o.status !== 'canceled' && (now - o.createdAt) / DAY >= 7) for (const l of o.items) base.set(l.productId, (base.get(l.productId) || 0) + l.qty);
  const naturallyLow = new Set(others.sort(() => rnd() - 0.5).slice(0, 2).map((p) => p.id));
  const outProducts = products.map((p) => {
    const perDay = (base.get(p.id) || 0) / Math.max(1, days - 7);
    const reorderLevel = Math.max(3, Math.ceil(perDay * 7));
    const low = storyIds.has(p.id) || naturallyLow.has(p.id);
    const stock = low ? Math.min(reorderLevel - 1, 1 + Math.floor(rnd() * 3)) : Math.max(reorderLevel + 2, Math.round(perDay * (8 + rnd() * 30)));
    return { _id: p.id, name: p.name, category: p.category, price: p.price, stock: Math.max(0, stock), reorderLevel, isDemo: true };
  });
  return { products: outProducts, orders, payments, carts, story: { category, productIds: [...storyIds], productNames: storyProducts.map((p) => p.name) } };
}
