import { z } from 'zod';
import { loadData } from './data/index.js';
import {
  ISSUES, abandonedCarts, listOrders, draftFromFacts, inr, lowStock, recentOrders, recoveryMessage, replyFacts, salesDrop,
} from './analytics.js';
import { polish } from './ai.js';

// Every tool returns: a short spoken summary first (what Alexa+ reads aloud), then the evidence as JSON.
const reply = (speech, evidence) => ({
  content: [{ type: 'text', text: `${speech}\n\nEvidence:\n${JSON.stringify(evidence, null, 2)}` }],
});
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function registerTools(server) {
  server.registerTool(
    'list_orders',
    {
      title: 'Latest orders',
      description: 'Lists the most recent orders with their ids, customer first name, status and total. Use it to find an order id.',
      inputSchema: {
        limit: z.number().int().min(1).max(25).default(5),
        status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'canceled']).optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ limit, status }) => {
      const list = listOrders(await loadData(), limit, status);
      const speech = list.length
        ? `Here are your ${list.length} latest orders. The newest is ${list[0].id} from ${list[0].customer}, ${inr(list[0].total)}, ${list[0].status}.${list[1] ? ` Others: ${list.slice(1, 4).map((o) => o.id).join(', ')}.` : ''}`
        : 'There are no orders to show.';
      return reply(speech, list);
    }
  );

  server.registerTool(
    'get_recent_orders',
    {
      title: 'Recent orders',
      description: 'How many orders came in recently, the revenue, and which orders still need action (pending or paid but not shipped).',
      inputSchema: { hours: z.number().int().min(1).max(168).default(24).describe('Look-back window in hours') },
      annotations: READ_ONLY,
    },
    async ({ hours }) => {
      const r = recentOrders(await loadData(), hours);
      const speech = `In the last ${hours} hours you received ${r.orderCount} orders worth ${inr(r.revenue)}. ${r.needAction.length} still need action.`;
      return reply(speech, r);
    }
  );

  server.registerTool(
    'get_low_stock_products',
    {
      title: 'Low stock products',
      description: 'Products at or below their reorder level, ordered by urgency using the last 14 days of sales.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      const list = lowStock(await loadData());
      const speech = list.length
        ? `${list.length} products are low. Most urgent: ${list[0].name} with ${list[0].stock} left${list[0].daysOfCover ? `, about ${list[0].daysOfCover} days of cover` : ''}.`
        : 'No products are below their reorder level.';
      return reply(speech, list);
    }
  );

  server.registerTool(
    'analyze_sales_drop',
    {
      title: 'Why did sales change?',
      description: 'Compares the last N days with the N days before, by category, and lists likely drivers such as low stock and failed payments.',
      inputSchema: { days: z.number().int().min(1).max(30).default(7) },
      annotations: READ_ONLY,
    },
    async ({ days }) => {
      const r = salesDrop(await loadData(), days);
      const dir = r.revenueChangePct === null ? 'changed' : r.revenueChangePct < 0 ? 'fell' : 'rose';
      let speech = `Revenue ${dir}${r.revenueChangePct === null ? '' : ` ${Math.abs(r.revenueChangePct)} percent`} over the last ${days} days, from ${inr(r.previous.revenue)} to ${inr(r.current.revenue)}.`;
      if (r.causes[0]) {
        speech += ` Biggest decline: ${r.causes[0].category}, down ${Math.abs(r.causes[0].changePct)} percent. ${r.causes[0].likelyDrivers[0]}.`;
      }
      return reply(speech, r);
    }
  );

  server.registerTool(
    'find_abandoned_carts',
    {
      title: 'Abandoned carts',
      description: 'Carts left idle, highest value first, each with a drafted recovery message. Drafts only; nothing is sent.',
      inputSchema: { minHours: z.number().min(0.5).max(168).default(1) },
      annotations: READ_ONLY,
    },
    async ({ minHours }) => {
      const carts = abandonedCarts(await loadData(), minHours).map((c) => ({ ...c, draftMessage: recoveryMessage(c) }));
      const total = carts.reduce((s, c) => s + c.value, 0);
      const speech = carts.length
        ? `${carts.length} carts are waiting, worth ${inr(total)} in total. The biggest is ${carts[0].customer}'s at ${inr(carts[0].value)}.`
        : 'No abandoned carts right now.';
      return reply(speech, carts);
    }
  );

  server.registerTool(
    'draft_customer_reply',
    {
      title: 'Draft a customer reply',
      description: 'Drafts a reply to a customer issue using the real order status and store policy. It only drafts; the owner must send it.',
      inputSchema: {
        orderId: z.string().min(1).describe('Order id, for example O1012'),
        issue: z.enum(ISSUES),
      },
      annotations: READ_ONLY,
    },
    async ({ orderId, issue }) => {
      const facts = replyFacts(await loadData(), orderId, issue);
      if (!facts.found) return reply(`I could not find order ${orderId}.`, { found: false });
      const { text, polished } = await polish(draftFromFacts(facts));
      return reply(`Here is a draft reply for order ${orderId}. I have not sent it.`, { draft: text, polishedByAI: polished, facts });
    }
  );
}
