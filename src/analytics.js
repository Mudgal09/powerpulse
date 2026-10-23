// Pure functions: take plain data in, return facts out. No I/O, so they are easy to test.
// Every number the assistant speaks comes from these functions, never from the LLM.

const DAY = 24 * 60 * 60 * 1000;
const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
export { inr };

export const orderTotal = (o) => o.items.reduce((s, i) => s + i.qty * i.price, 0);

// Canceled orders are never revenue and never count toward sales velocity.
const live = (o) => o.status !== 'canceled';

const within = (date, fromMs, toMs) => {
  const t = new Date(date).getTime();
  return t >= fromMs && t < toMs;
};

export function recentOrders({ orders }, hours = 24, now = Date.now()) {
  const all = orders.filter((o) => within(o.placedAt, now - hours * 3600 * 1000, now + 1));
  const list = all.filter(live);
  const byStatus = {};
  for (const o of all) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  const revenue = list.reduce((s, o) => s + orderTotal(o), 0);
  const needAction = list.filter((o) => o.status === 'pending' || o.status === 'paid').map((o) => o.id);
  return { windowHours: hours, orderCount: list.length, revenue, byStatus, needAction };
}

export function lowStock({ products, orders }, now = Date.now()) {
  const sold = {};
  for (const o of orders) {
    if (!live(o) || !within(o.placedAt, now - 14 * DAY, now + 1)) continue;
    for (const i of o.items) sold[i.productId] = (sold[i.productId] || 0) + i.qty;
  }
  return products
    .filter((p) => p.stock <= p.reorderLevel)
    .map((p) => {
      const perDay = (sold[p.id] || 0) / 14;
      const daysOfCover = perDay > 0 ? +(p.stock / perDay).toFixed(1) : null;
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        stock: p.stock,
        reorderLevel: p.reorderLevel,
        unitsSoldLast14Days: sold[p.id] || 0,
        daysOfCover,
      };
    })
    .sort((a, b) => (a.daysOfCover ?? 1e9) - (b.daysOfCover ?? 1e9));
}

function windowStats({ orders, products }, fromMs, toMs) {
  const cat = Object.fromEntries(products.map((p) => [p.id, p.category]));
  const list = orders.filter((o) => live(o) && within(o.placedAt, fromMs, toMs));
  const byCategory = {};
  for (const o of list) {
    for (const i of o.items) {
      const c = cat[i.productId];
      byCategory[c] = (byCategory[c] || 0) + i.qty * i.price;
    }
  }
  return { orders: list.length, revenue: list.reduce((s, o) => s + orderTotal(o), 0), byCategory };
}

export function salesDrop(data, days = 7, now = Date.now()) {
  const cur = windowStats(data, now - days * DAY, now + 1);
  const prev = windowStats(data, now - 2 * days * DAY, now - days * DAY);
  const pct = (a, b) => (b === 0 ? null : +(((a - b) / b) * 100).toFixed(1));

  const categories = new Set([...Object.keys(cur.byCategory), ...Object.keys(prev.byCategory)]);
  const categoryChanges = [...categories]
    .map((c) => ({
      category: c,
      current: cur.byCategory[c] || 0,
      previous: prev.byCategory[c] || 0,
      changePct: pct(cur.byCategory[c] || 0, prev.byCategory[c] || 0),
    }))
    .sort((a, b) => a.current - a.previous - (b.current - b.previous));

  const low = lowStock(data, now);
  const failed = data.payments.filter((p) => p.status === 'failed' && within(p.at, now - days * DAY, now + 1));
  const prod = Object.fromEntries(data.products.map((p) => [p.id, p]));

  const causes = [];
  for (const c of categoryChanges) {
    if (c.changePct === null || c.changePct > -25) continue;
    const lowInCat = low.filter((p) => p.category === c.category);
    const failedInCat = failed.filter((f) => prod[f.productId]?.category === c.category);
    const evidence = [];
    if (lowInCat.length) {
      evidence.push(`${lowInCat.map((p) => `${p.name} (${p.stock} left)`).join(', ')} at or below reorder level`);
    }
    if (failedInCat.length) {
      const reasons = {};
      for (const f of failedInCat) reasons[f.reason] = (reasons[f.reason] || 0) + 1;
      evidence.push(
        `${failedInCat.length} failed payment attempts in the window (${Object.entries(reasons)
          .map(([r, n]) => `${r}: ${n}`)
          .join(', ')})`
      );
    }
    causes.push({
      category: c.category,
      changePct: c.changePct,
      likelyDrivers: evidence.length ? evidence : ['No stock or payment issue found; may be demand or seasonality'],
    });
  }

  return {
    windowDays: days,
    current: { orders: cur.orders, revenue: cur.revenue },
    previous: { orders: prev.orders, revenue: prev.revenue },
    revenueChangePct: pct(cur.revenue, prev.revenue),
    orderChangePct: pct(cur.orders, prev.orders),
    categoryChanges,
    failedPayments: failed.length,
    causes,
  };
}

export function abandonedCarts({ carts }, minHours = 1, now = Date.now()) {
  return carts
    .filter((c) => now - new Date(c.updatedAt).getTime() >= minHours * 3600 * 1000)
    .map((c) => ({
      id: c.id,
      customer: c.customer,
      hoursIdle: +((now - new Date(c.updatedAt).getTime()) / 3600000).toFixed(1),
      value: c.items.reduce((s, i) => s + i.qty * i.price, 0),
      items: c.items,
    }))
    .sort((a, b) => b.value - a.value);
}

export const ISSUES = ['where_is_my_order', 'delay', 'damaged_item', 'refund_request'];

export function replyFacts({ orders, policy }, orderId, issue) {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return { found: false };
  return {
    found: true,
    orderId: order.id,
    customer: order.customer,
    status: order.status,
    total: orderTotal(order),
    placedAt: order.placedAt,
    issue,
    policy,
  };
}

// Deterministic, grounded draft. An LLM may polish the wording but never changes these facts.
export function draftFromFacts(f) {
  const hi = `Hi ${f.customer},`;
  const bye = 'Thank you for shopping with us.';
  switch (f.issue) {
    case 'where_is_my_order':
      return `${hi}\nYour order ${f.orderId} (${inr(f.total)}) is currently "${f.status}". Standard delivery takes ${f.policy.shippingDays}. We will update you as soon as its status changes.\n${bye}`;
    case 'delay':
      return `${hi}\nSorry for the wait on order ${f.orderId}. It is currently "${f.status}", and delivery normally takes ${f.policy.shippingDays}. We are following up on it and will update you shortly.\n${bye}`;
    case 'damaged_item':
      return `${hi}\nWe are sorry that your item from order ${f.orderId} arrived damaged. Please send a photo of the item and packaging, and we will arrange a replacement or refund. Damage claims are accepted within ${f.policy.returnWindowDays} days of delivery.\n${bye}`;
    case 'refund_request':
      return `${hi}\nWe have noted your refund request for order ${f.orderId} (${inr(f.total)}). Refunds are processed within ${f.policy.refundDays}. Returns are accepted within ${f.policy.returnWindowDays} days of delivery.\n${bye}`;
    default:
      return `${hi}\nThanks for contacting us about order ${f.orderId}. We are looking into it.\n${bye}`;
  }
}

export function recoveryMessage(cart) {
  return `Hi ${cart.customer}, you left items worth ${inr(cart.value)} in your cart. They are still available, so you can complete your order whenever you are ready.`;
}

export function listOrders({ orders }, limit = 5, status) {
  return orders
    .filter((o) => !status || o.status === status)
    .sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt))
    .slice(0, limit)
    .map((o) => ({ id: o.id, customer: o.customer, status: o.status, total: orderTotal(o), placedAt: new Date(o.placedAt).toISOString(), items: o.items.length }));
}
