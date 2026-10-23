// Reads your MongoDB (real or demo database) and returns PowerPulse's canonical data.
// Env: MONGODB_URI, MONGODB_DB (database name), MONGO_ORDER_DAYS (default 30).
import { MongoClient } from 'mongodb';
import { policy } from './sample.js';
import { normalizeCart, normalizeOrder, normalizePayment, normalizeProduct } from './mongoMap.js';

let client;

// Data minimisation: never pull personal or payment-secret fields into the app.
const NO_PII = { projection: { shippingAddress: 0, paymentResult: 0, email: 0, phone: 0, address: 0, password: 0 } };

export async function loadFromDb(db, days = 30) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const recent = { $or: [{ createdAt: { $gte: since } }, { placedAt: { $gte: since } }, { orderDate: { $gte: since } }] };
  const [products, orders, carts, failed] = await Promise.all([
    db.collection('products').find({}, NO_PII).toArray(),
    db.collection('orders').find(recent, NO_PII).toArray(),
    db.collection('carts').find({}, NO_PII).toArray(),
    db.collection('payments').find({ status: /fail/i, ...recent }, NO_PII).toArray(),
  ]);
  return {
    products: products.map(normalizeProduct).map((p) => ({ ...p, stock: p.stock ?? 0 })),
    orders: orders.map(normalizeOrder).filter((o) => !isNaN(o.placedAt)),
    payments: failed.map(normalizePayment),
    carts: carts.map(normalizeCart).filter((c) => !isNaN(c.updatedAt)),
    policy,
  };
}

export async function loadFromMongo() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');
  client ??= await new MongoClient(process.env.MONGODB_URI).connect();
  return loadFromDb(client.db(process.env.MONGODB_DB || undefined), Number(process.env.MONGO_ORDER_DAYS || 30));
}
