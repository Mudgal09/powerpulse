import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools.js';

const PORT = Number(process.env.PORT || 3000);
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(here, '..', 'public'))); // the web UI

// Origin validation: block browser pages from unknown origins (DNS-rebinding protection per the MCP spec).
// Requests with no Origin header (server-to-server clients such as Alexa+) are allowed.
app.use(['/mcp', '/api'], (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowed.includes(origin)) return res.status(403).json({ error: 'Origin not allowed' });
  next();
});

function buildServer() {
  const server = new McpServer({ name: 'powerpulse', version: '0.1.0' });
  registerTools(server);
  return server;
}

// The web UI talks to the very same tools through an in-process MCP client (no duplicated logic).
const TOOL_NAMES = ['get_recent_orders', 'list_orders', 'get_low_stock_products', 'analyze_sales_drop', 'find_abandoned_carts', 'draft_customer_reply'];
let uiClient;
async function getUiClient() {
  if (!uiClient) {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await buildServer().connect(serverSide);
    const c = new Client({ name: 'powerpulse-ui', version: '0.1.0' });
    await c.connect(clientSide);
    uiClient = c;
  }
  return uiClient;
}
app.post('/api/call', async (req, res) => {
  const { name, arguments: args } = req.body || {};
  if (!TOOL_NAMES.includes(name)) return res.status(400).json({ error: 'Unknown tool' });
  try {
    const client = await getUiClient();
    res.json(await client.callTool({ name, arguments: args || {} }));
  } catch (err) {
    console.error('UI call error:', err);
    res.status(500).json({ error: 'Tool call failed' });
  }
});

// Stateless Streamable HTTP: a fresh server and transport per request.
app.post('/mcp', async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP error:', err);
    if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
  }
});

const notAllowed = (_req, res) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
app.get('/mcp', notAllowed);
app.delete('/mcp', notAllowed);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'powerpulse', dataSource: process.env.DATA_SOURCE || 'sample' }));

app.listen(PORT, () => console.log(`PowerPulse MCP server listening on http://localhost:${PORT}/mcp`));
