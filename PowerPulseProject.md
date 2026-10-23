# PowerPulse: Project Summary

> Paste this whole file at the start of a new chat to continue the project with full context.
> Last updated: 10 Oct 2026 · Owner: Rohit Mudgal

## 1. One-line pitch
SellerPulse is a voice and AI business copilot for small online sellers. The owner asks Alexa+ questions like "why did my sales drop this week?" and gets answers grounded in real store data (orders, stock, payments, carts), plus drafted customer replies.

## 2. Hackathon context
- **Event:** Build, Ship, Shape: Amazon Developer Hackathon (Devpost, amazonappdev2026.devpost.com)
- **Track:** Alexa+ (MCP-based experience). Confirm the exact track rules on the Devpost Rules/Resources tabs.
- **Deadline:** shown as **Oct 24, 2026 @ 12:30am GMT+5:30**, which means effectively the night of **Oct 23**. Plan to submit by the evening of Oct 23 at the latest.
- **Secondary goal:** a strong Amazon interview story (Customer Obsession, Dive Deep, Ownership, Deliver Results).

## 3. The real business problem
Small sellers have no analytics team. They notice stock-outs, failed payments, abandoned carts and unhappy customers late, or never. Dashboards are slow and complex. SellerPulse turns those into one spoken question.

## 4. What is built (status as of 10 Oct 2026)
| Part | Status |
|---|---|
| MCP server (Node.js, Express 5, official MCP SDK 1.32, Streamable HTTP at `/mcp`, stateless) | Built, tested locally |
| 5 read-only tools (below) | Built, tested with a real MCP client |
| Analytics layer (pure functions, all numbers computed in code) | Built, tested |
| Origin validation on `/mcp` | Built, tested (bad origin returns 403) |
| Sample dataset with an explainable "sales drop" | Built |
| Eval harness | 12 cases, 12/12 passing |
| Optional Gemini wording polish for drafted replies | Written, **not tested** (needs an API key) |
| MongoDB adapter for the real Rohit Power Tools data | **Template only**, field names must be mapped to your schema |
| Connecting to Alexa+ (registration, public HTTPS URL) | **Not done** |
| Deployment on Render | **Not done** |
| Demo video, Devpost write-up | **Not done** |

## 5. Tools exposed over MCP
All tools are read-only. Each returns a short spoken summary first, then the evidence as JSON.

| Tool | What it answers |
|---|---|
| `get_recent_orders` | Orders and revenue in the last N hours, and which orders need action |
| `get_low_stock_products` | Products at or below reorder level, ranked by days of cover (14-day sales velocity) |
| `analyze_sales_drop` | Last N days vs the N before, by category, with likely drivers (low stock, failed payments) |
| `find_abandoned_carts` | Idle carts by value, each with a drafted recovery message (nothing is sent) |
| `draft_customer_reply` | Drafts a reply using the real order status and store policy (the owner sends it) |

## 6. Architecture and design decisions
- **Grounding:** every number comes from code in `src/analytics.js`. The LLM never invents figures. It may only rephrase a drafted reply (`src/ai.js`), and falls back to the grounded draft if the key is missing or the call fails.
- **Safety:** tools are read-only, replies are drafts, and the owner always confirms before anything is sent. Only first names are exposed. The `/mcp` endpoint rejects unknown browser origins.
- **Stateless server:** a new server and transport per request, which suits serverless or Render deployment.
- **Data layer:** `src/data/index.js` selects `sample` or `mongo` via `DATA_SOURCE`, so the demo runs without a database.

## 7. Project structure
```
sellerpulse/
  src/server.js          Express + MCP Streamable HTTP endpoint (/mcp, /health)
  src/tools.js           The 5 MCP tools
  src/analytics.js       Pure functions computing all facts
  src/ai.js              Optional Gemini polish (grounded)
  src/data/index.js      Data source switch
  src/data/sample.js     Demo data
  src/data/mongoAdapter.js  Template for the real database
  eval/run-eval.js       Ground-truth evaluation cases
  eval/mcp-smoke.js      End-to-end MCP client test
  .env.example
```

## 8. How to run
```bash
npm install
cp .env.example .env     # optional
npm start                # http://localhost:3000/mcp  (health: /health)
npm test                 # evaluation cases
node eval/mcp-smoke.js   # needs the server running in another terminal
```
Requires Node.js 20 or newer.

## 9. Next steps (plan to Oct 23)
| Days | Goal |
|---|---|
| Oct 10-11 | Read Devpost Alexa+ track rules and judging criteria; confirm how an MCP server is registered or demoed for Alexa+ |
| Oct 11-13 | Map `mongoAdapter.js` to the real Rohit Power Tools schema; add Razorpay `payment.failed` webhook storage |
| Oct 13-15 | Deploy to Render over HTTPS; connect to Alexa+ (or the simulated Alexa+ experience if that is what the rules allow) |
| Oct 15-17 | Interview 2-3 real shop owners; collect their real questions; grow the eval set toward ~50 questions |
| Oct 17-19 | Measure latency (add caching and indexes), handle errors and add logging |
| Oct 19-21 | Small user test with 5-10 people; record time saved and feedback |
| Oct 21-22 | Record demo video (about 2 minutes), write Devpost description, screenshots, architecture diagram |
| Oct 23 | Final checks and submit (do not wait for the last hour) |

## 10. Metrics to collect (only claim what you measure)
- Eval accuracy on the question set (currently 12/12 on the small sample set; this is not a real-world accuracy claim)
- Response latency before and after optimization
- Hallucination or wrong-number rate (target: 0 by design, since numbers come from code)
- User test results: tasks completed, time saved, quotes
- Real-store facts: number of products and orders the tool was run on

## 11. Interview story (fill in the real results later)
- **Situation:** Small sellers miss stock-outs, failed payments and abandoned carts because dashboards are slow and complex.
- **Task:** Make business insight accessible by voice with answers the owner can trust.
- **Action:** Built an MCP server over live order, stock and payment data. Computed every number in code, added a ground-truth evaluation set, optimized queries and tested with real shop owners.
- **Result:** `[your measured accuracy, latency and user feedback]`
- **Learning:** `[what failed first and how you fixed it]`
- **Likely follow-ups to prepare:** why compute numbers in code instead of letting the LLM answer; how you handle an AI or database outage; how you would scale it; what you would do with write actions and why they need confirmation.

## 12. Open questions and risks
- How exactly Alexa+ connects to a self-hosted MCP server for this hackathon (check the Resources tab)
- Real schema of the Rohit Power Tools database (field names, status values)
- Failed-payment data requires storing Razorpay webhook events, which the store may not do yet
- Keep the claims honest: the sample data is demo data, so say so in the Devpost write-up and show real-store results separately

## 13. Decision log
- 10 Oct 2026: chose SellerPulse (Alexa+ track) over a voice tutor, MCP dev assistant and a Fire TV app, because it builds on the real Rohit Power Tools store and gives a strong business story.
- 10 Oct 2026: tools are read-only and replies are drafts only, for safety and trust.

## 14. Continuing in a new chat
Paste this file and say: "Continue the SellerPulse project from section 9." Also attach any changed files, or the project zip.
