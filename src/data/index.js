import fs from 'node:fs';
import * as sample from './sample.js';

// Loads { products, orders, payments, carts, policy } from the configured source.
// Results are cached briefly so one dashboard load (5 tool calls) reads the data once, not five times.
let cache = null;

async function readSource() {
  const source = (process.env.DATA_SOURCE || 'sample').toLowerCase();
  if (source === 'mongo') {
    const { loadFromMongo } = await import('./mongoAdapter.js');
    return loadFromMongo();
  }
  if (source === 'olist') {
    const file = new URL('../../data/olist-store.json', import.meta.url);
    if (!fs.existsSync(file)) throw new Error('data/olist-store.json not found. Run: npm run import:olist -- <folder>');
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    // Slide all dates so the newest order is "now", keeping "last 7 days" questions meaningful on old data.
    const shift = Date.now() - new Date(d.meta.latestOrderAt).getTime();
    const mv = (x) => new Date(new Date(x).getTime() + shift);
    return {
      ...d,
      orders: d.orders.map((o) => ({ ...o, placedAt: mv(o.placedAt) })),
      payments: d.payments.map((p) => ({ ...p, at: mv(p.at) })),
    };
  }
  return { products: sample.products, orders: sample.orders, payments: sample.payments, carts: sample.carts, policy: sample.policy };
}

export async function loadData() {
  const ttl = Number(process.env.DATA_CACHE_SECONDS ?? 30) * 1000;
  if (cache && Date.now() - cache.at < ttl) return cache.promise;
  const promise = readSource();
  cache = { at: Date.now(), promise };
  promise.catch(() => { if (cache?.promise === promise) cache = null; }); // never cache a failure
  return promise;
}
