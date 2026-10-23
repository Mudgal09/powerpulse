// Measures response time of each tool through the running server. Use it before/after optimizations.
// Usage: node eval/latency.js [runs=30]     Tip: DATA_CACHE_SECONDS=0 npm start  shows the uncached numbers.
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const RUNS = Number(process.argv[2] || 30);
const calls = [['get_recent_orders', { hours: 24 }], ['get_low_stock_products', {}], ['analyze_sales_drop', { days: 7 }], ['find_abandoned_carts', { minHours: 1 }]];
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];
console.log(`Runs per tool: ${RUNS}  (${BASE})\ntool                      p50 ms   p95 ms   max ms`);
for (const [name, args] of calls) {
  const t = [];
  for (let i = 0; i < RUNS; i++) {
    const s = performance.now();
    const r = await fetch(`${BASE}/api/call`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, arguments: args }) });
    await r.json(); t.push(performance.now() - s);
  }
  t.sort((a, b) => a - b);
  console.log(`${name.padEnd(25)} ${pct(t, 50).toFixed(1).padStart(6)} ${pct(t, 95).toFixed(1).padStart(8)} ${t[t.length - 1].toFixed(1).padStart(8)}`);
}
