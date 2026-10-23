// Builds a clearly labeled SYNTHETIC demo database from your REAL products. Never writes to your real database.
// Usage:  npm run seed:demo                 (preview only)
//         npm run seed:demo -- --confirm    (writes)     options: --days=60 --story-category=Drills
// Env:    MONGODB_URI, MONGODB_DB (source, your real db), DEMO_DB (default "<MONGODB_DB>-demo")
import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { generate } from '../src/seed/generate.js';
import { normalizeOrder, normalizeProduct } from '../src/data/mongoMap.js';
import { salesDrop } from '../src/analytics.js';

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const source = process.env.MONGODB_DB;
if (!process.env.MONGODB_URI || !source) { console.error('Set MONGODB_URI and MONGODB_DB (your real database name) in .env.'); process.exit(1); }
const demoName = process.env.DEMO_DB || `${source}-demo`;
if (demoName === source) { console.error('Refusing: demo database must differ from the source database.'); process.exit(1); }

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const real = (await client.db(source).collection('products').find({}).toArray()).map(normalizeProduct);
const data = generate({ products: real, days: Number(opt.days || 60), seed: Number(opt.seed || 7), storyCategory: opt['story-category'] });
console.log(`Real products read from "${source}": ${real.length}`);
console.log(`Demo data for "${demoName}": ${data.orders.length} orders, ${data.payments.length} failed payments, ${data.carts.length} carts`);
console.log(`Story: last 7 days, "${data.story.category}" sales fall; low stock + failed payments on: ${data.story.productNames.join(', ')}`);

// Self-check: can the analytics actually find the story in the generated data?
const check = salesDrop({
  products: data.products.map((p) => ({ id: p._id, ...p })),
  orders: data.orders.map(normalizeOrder),
  payments: data.payments.map((p) => ({ ...p, at: p.createdAt })),
}, 7);
const hit = check.causes.find((c) => c.category === data.story.category);
const top = check.categoryChanges[0];
console.log(hit
  ? `Story check: OK. ${hit.category} ${hit.changePct}% (${hit.likelyDrivers.join('; ')})${top.category !== hit.category ? `\n  Note: ${top.category} has the biggest absolute dip by chance; try another --seed if you want the story to lead.` : ''}`
  : 'Story check: WEAK. The story is not clearly visible with this seed. Try --seed=1, --seed=2, ...');

if (!opt.confirm) { console.log('\nPreview only. Add --confirm to write (this replaces the demo collections).'); await client.close(); process.exit(0); }
const demo = client.db(demoName);
for (const [name, docs] of Object.entries({ products: data.products, orders: data.orders, payments: data.payments, carts: data.carts })) {
  await demo.collection(name).deleteMany({});
  if (docs.length) await demo.collection(name).insertMany(docs);
  console.log(`Wrote ${docs.length} -> ${demoName}.${name}`);
}
await demo.collection('orders').createIndex({ createdAt: -1 });
console.log(`\nDone. Use it with:  MONGODB_DB=${demoName}  DATA_SOURCE=mongo   (every document has isDemo: true)`);
await client.close();
