// End-to-end check: connects to the running server with a real MCP client, lists tools and calls each one.
// Usage:  npm start   (in one terminal)   then   node eval/mcp-smoke.js   (in another)
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = new URL(process.env.MCP_URL || 'http://localhost:3000/mcp');
const client = new Client({ name: 'smoke-test', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(url));

const { tools } = await client.listTools();
console.log('Tools:', tools.map((t) => t.name).join(', '));

const calls = [
  ['get_recent_orders', { hours: 24 }],
  ['get_low_stock_products', {}],
  ['analyze_sales_drop', { days: 7 }],
  ['find_abandoned_carts', { minHours: 1 }],
  ['draft_customer_reply', { orderId: 'O1012', issue: 'where_is_my_order' }],
  ['draft_customer_reply', { orderId: 'O9999', issue: 'delay' }],
];
for (const [name, args] of calls) {
  const r = await client.callTool({ name, arguments: args });
  console.log(`\n▶ ${name} ${JSON.stringify(args)}\n  ${r.content[0].text.split('\n')[0]}`);
}
await client.close();
