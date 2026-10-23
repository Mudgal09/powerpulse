// Turns "whatever shape your MongoDB documents have" into PowerPulse's canonical shape.
// Tries common MERN shop field names. If your schema differs, inspect it (npm run inspect:mongo) and add the name here.
const get = (o, path) => path.split('.').reduce((a, p) => (a == null ? undefined : a[p]), o);
const pick = (o, paths) => { for (const p of paths) { const v = get(o, p); if (v !== undefined && v !== null && v !== '') return v; } return undefined; };
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v) => (v == null ? v : String(v));

export function normalizeStatus(doc) {
  const raw = pick(doc, ['status', 'orderStatus', 'state']);
  if (raw !== undefined) {
    const k = String(raw).toLowerCase().replace(/[\s_-]/g, '');
    if (/^(delivered|completed|fulfilled)$/.test(k)) return 'delivered';
    if (/^(shipped|dispatched|intransit|outfordelivery)$/.test(k)) return 'shipped';
    if (/^(paid|processing|confirmed|accepted|packed|approved)$/.test(k)) return 'paid';
    if (/^(cancelled|canceled|failed|refunded|rejected|returned)$/.test(k)) return 'canceled';
    return 'pending';
  }
  // Common tutorial-style schema: isDelivered / isPaid booleans.
  if (doc.isDelivered) return 'delivered';
  if (doc.isPaid) return 'paid';
  return 'pending';
}

export function normalizeProduct(d) {
  const cat = pick(d, ['category.name', 'category', 'categoryName', 'type', 'brand']);
  const stockRaw = pick(d, ['stock', 'countInStock', 'quantity', 'inventory', 'qty']);
  return {
    id: str(d._id),
    name: str(pick(d, ['name', 'title', 'productName'])) ?? 'Unnamed product',
    category: typeof cat === 'string' ? cat : 'Uncategorized',
    price: num(pick(d, ['price', 'salePrice', 'mrp', 'sellingPrice'])),
    stock: stockRaw === undefined ? null : num(stockRaw),
    reorderLevel: num(pick(d, ['reorderLevel', 'lowStockThreshold']), 5),
  };
}

const lines = (arr) => (Array.isArray(arr) ? arr : []).map((i) => ({
  productId: str(pick(i, ['productId', 'product._id', 'product', '_id'])),
  qty: num(pick(i, ['qty', 'quantity', 'count']), 1),
  price: num(pick(i, ['price', 'unitPrice', 'product.price'])),
}));
const firstName = (d) => {
  const n = pick(d, ['customerName', 'user.name', 'shippingAddress.fullName', 'customer.name']);
  return typeof n === 'string' && n.trim() ? n.trim().split(/\s+/)[0] : 'Customer';
};

export function normalizeOrder(d) {
  return {
    id: str(d._id),
    customer: firstName(d),
    placedAt: new Date(pick(d, ['createdAt', 'placedAt', 'orderDate', 'date'])),
    status: normalizeStatus(d),
    items: lines(pick(d, ['items', 'orderItems', 'products', 'cartItems', 'line_items'])),
  };
}

export function normalizeCart(d) {
  return {
    id: str(d._id),
    customer: firstName(d),
    updatedAt: new Date(pick(d, ['updatedAt', 'createdAt'])),
    items: lines(pick(d, ['items', 'cartItems', 'products'])),
  };
}

export function normalizePayment(d) {
  return {
    orderId: str(pick(d, ['orderId', 'order'])) ?? null,
    productId: str(pick(d, ['productId', 'product'])) ?? null,
    at: new Date(pick(d, ['createdAt', 'at', 'timestamp'])),
    status: /fail/i.test(String(pick(d, ['status']))) ? 'failed' : 'success',
    reason: str(pick(d, ['reason', 'failureReason', 'error.description'])) ?? 'unknown',
  };
}
