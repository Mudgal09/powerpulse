// Prints the SHAPE of your products/orders/carts/payments documents (field names and types) so the mapper can be matched
// to your schema. Personal and payment fields are redacted, and users/sessions collections are never read.
// Usage: npm run inspect:mongo      (needs MONGODB_URI and MONGODB_DB in .env)
import 'dotenv/config';
import { MongoClient } from 'mongodb';

const SENSITIVE = /(full ?name|first|last|email|phone|mobile|address|street|city|state|pin|zip|country|password|token|secret|razorpay|signature|payment.?(id|result)|user|customer|contact)/i;
const shape = (v, key = '', depth = 0) => {
  if (SENSITIVE.test(key)) return '<redacted>';
  if (v === null) return 'null';
  if (v instanceof Date) return 'Date';
  if (Array.isArray(v)) return v.length ? [`array(${v.length})`, shape(v[0], key, depth + 1)] : 'array(0)';
  if (typeof v === 'object') {
    if (v._bsontype) return v._bsontype;
    if (depth > 3) return 'object';
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, k, depth + 1)]));
  }
  if (typeof v === 'string') return `string "${v.slice(0, 24)}${v.length > 24 ? '…' : ''}"`;
  return `${typeof v} ${v}`;
};

if (!process.env.MONGODB_URI) { console.error('Set MONGODB_URI in .env first.'); process.exit(1); }
const client = await new MongoClient(process.env.MONGODB_URI).connect();
const db = client.db(process.env.MONGODB_DB || undefined);
console.log(`Database: ${db.databaseName}\n`);
const names = (await db.listCollections().toArray()).map((c) => c.name);
for (const name of names) console.log(`- ${name}: ${await db.collection(name).estimatedDocumentCount()} documents`);
for (const name of ['products', 'orders', 'carts', 'payments']) {
  if (!names.includes(name)) { console.log(`\n[${name}] collection not found`); continue; }
  const doc = await db.collection(name).findOne({});
  console.log(`\n[${name}] sample document shape:\n${doc ? JSON.stringify(shape(doc), null, 2) : '(empty)'}`);
}
await client.close();
