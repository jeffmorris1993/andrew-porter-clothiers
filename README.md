# Client Intelligence Desk

**AI-assisted prospect research and decision support for Andrew Porter Fine Clothiers.**
A concept demo by Sirrom Studios.

> This demo shows how AI can reduce research and preparation time. It does not promise new
> customers or sales. It never contacts anyone, never changes a CRM, and leaves every decision
> to Andrew.

## What it does

Three workspaces share one research engine and follow the decision loop from Glam District:
**Observe → Investigate → Explore → Compare → Decide.**

| Workspace | What Andrew does |
| --- | --- |
| **Research Prospect** | Enter a name (plus optional company, region and interest-card details). The desk identifies the person (asking Andrew to choose if several people share the name), researches their public professional background, and produces a brief: overview, AI summary, source-linked findings, customer-provided info (kept separate), gaps, preparation insights and 2–3 next-step options. |
| **Discover Professionals** | Describe a region and roles. Get a short list of named professionals supported by sources — never padded to the requested count. Open any result in Research Prospect. |
| **Decision Desk** | Save, dismiss and compare up to 3 profiles side by side; inspect evidence; run more research; generate an editable email draft and a simulated Insightly note; record decisions. |

| **Client Journey** | A simulated, connected client experience. **Client view:** branded welcome → short interest card → style questionnaire → consultation request → personal portal → order timeline → continuing relationship. **Andrew's workspace:** the same inquiry, organized as soon as it's sent, with an AI preparation brief, an editable personal message, and explicit decisions (approve a time, ask a question, record a preference, advance the order). A guided 11-step demo strip and **Reset journey** make it repeatable. |

**Ask the AI** (a side panel on any brief or comparison) answers from the existing research only. When
it can't, it says so and offers a bounded extra web search.

## Demo Mode and Live Mode

| | Demo Mode | Live Mode |
| --- | --- | --- |
| Data | Fictional people, companies and `.example` sources | Real OpenAI Responses API + `web_search` |
| Needs a key | No | `OPENAI_API_KEY` on the server |
| Labeling | Brass "Sample data" banner and tags throughout | Navy "Live" banner, real citation links, usage readout |
| Failure | n/a | Shows the error with retry. **Never falls back to sample data.** |

Demo and Live research are stored separately and never mixed on the desk.

## Client Journey — what is real and what is simulated

| | |
| --- | --- |
| **Live AI** (Live Mode only) | The consultation preparation brief and message draft: one structured OpenAI call (`/api/journey/brief`), **no web search**. Only the customer's answers and first name are sent — never email, phone or surname — and only after the customer agreed and Andrew confirms. Prices, measurements and availability are filtered out of the output. |
| **Demo sample** | In Demo Mode the brief is built by simple rules from the answers and labeled "Sample response · not AI". |
| **Simulated workflow** | Intake, appointment requests and approvals, order milestones, portal messages, past orders. Fictional customer, no real transactions — even in Live Mode. |
| **Not connected (future)** | Calendar booking, deposits/payments, Insightly, Constant Contact, email/SMS delivery, client sign-in, a shared backend. |

The journey state lives in this browser (`localStorage`), shared by both perspectives and across tabs
of the same browser. Using it across separate devices would need a production backend. Milestone
labels are in `lib/journey/milestones.ts` so they can be matched to Andrew's actual process. Researching
a client's public background is a separate button that opens Research Prospect — it never runs
automatically.

## Research architecture

```
Browser ── ResearchClient (lib/client/api.ts) ─┬─ demoClient → lib/demo (fixtures, rule-based)
                                               └─ liveClient → /api/* routes (server only)
/api/* ── liveRoute wrapper (lib/server/handler.ts): Zod validation · rate limit · daily cap · usage log · typed errors
       └─ pipeline (lib/research/pipeline.ts)
            1. Search               EvidenceProvider.gather   → OpenAI web_search (lib/research/openai.ts)
            2. Identity resolution  identify()                → candidates; Andrew picks if > 1
            3. Evidence + verify    SourceRegistry            → ids for real cited/consulted URLs only
            4. Structured synthesis ReasoningModel.structured → zod structured output, no tools
            5. Next-step options    validated in code         → requiresHumanApproval: true
```

Key rules enforced **in code**, not just in prompts:

- **Sources come only from the web search tool** — `url_citation` annotations and
  `web_search_call.action.sources`. The model refers to sources by server-assigned ids (`S1`…);
  unknown ids are dropped. No URL is ever taken from model text.
- **Verification status is computed**, not generated: `corroborated` (≥2 independent domains),
  `single-source`, `conflicting` (sources disagree), `unverified` (no valid source).
- **Restricted sites are excluded** (LinkedIn, social media, people-search and property sites) and the
  brief says so.
- **Safety filter** removes statements about income, net worth, compensation, home value,
  protected characteristics, and personal contact or address details.
- **Customer-provided details** are shown separately and sent to the AI **only** if Andrew ticks the
  consent box in Live Mode.
- **Web content is untrusted**: research notes are passed to the synthesis step wrapped and labeled
  as data.
- **Bounded**: each request makes a fixed number of model calls (identify 2, brief 2, follow-up 2,
  discover 2, assistant 1, draft 1).

The provider interfaces in `lib/research/provider.ts` let other data sources be added later without
changing the pipeline or UI. Persistence goes through `lib/store/repository.ts` (localStorage today; a
Supabase repository can implement the same interface).

## Running it

```bash
npm install
cp .env.example .env.local   # add OPENAI_API_KEY for Live Mode
npm run dev
```

Open http://localhost:3000. Demo Mode works with no key.

### Tests

```bash
npm test            # unit + mocked integration (Vitest)
npm run test:e2e    # browser E2E (Playwright; run `npm run build` first)
npm run smoke:live -- "David A. Ricks" "Eli Lilly and Company"   # real API calls against a running server
```

### Cost monitoring

Every live response includes model, call count, web-search count and token usage, shown under
each result. The server also logs a `[usage]` line per request (visible in Vercel logs) and exposes a
per-instance summary at `GET /api/usage`. Rate limits and the daily cap are set in `.env`.

### Deploying to Vercel

Import the repo, set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) as environment variables,
and deploy. Research routes set `maxDuration` up to 180s. Rate limiting and usage tracking are
in-memory per instance — fine for a demo; use a shared store for production.

## Privacy and safety

- No inference of income, net worth, home value or purchasing power.
- No use of race, religion, ethnicity or other protected characteristics.
- No residential addresses or private contact details.
- No automated emails, texts or calls. Drafts are editable text for Andrew to copy if he chooses.
- No real CRM changes — the Insightly note is simulated.
- Do not enter real customer records in Live Mode without appropriate authorization.
