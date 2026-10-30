# VIDHYA-AI Backend: Phases to Scale Up

This roadmap assumes [REMEDIATION_PLAN.md](./REMEDIATION_PLAN.md) steps 1 to 3 are done (auth fixed, async errors handled, critical bugs closed). Scaling an insecure app only scales the problems.

User numbers below are planning guides, not measurements; replace them with real traffic once you have it. Move to the next phase when its trigger is hit, not before.

---

## Where you are today (Phase 0)

| Property | Current state |
|---|---|
| Processes | 1 Node process |
| Storage | One JSON file, fully rewritten on every change |
| Search/RAG | In-memory keyword scan |
| Jobs | In-memory Map, simulated |
| Realtime | In-process WebSocket sets |
| AI | One provider call per request, no limits |
| Observability | `console.log` |

**Comfortable for:** a demo, a classroom pilot, tens of users. The JSON file and in-memory state are the first things to break.

---

## Phase 1: Solid single-server (target: ~1,000 registered users)

**Trigger:** the app is used by real students outside your team.

### Do

1. Finish the remediation plan (auth, validation, error handling, tests, CI).
2. Move the DB to **Postgres** (managed, e.g. Neon, Supabase or RDS) with a migration tool (Drizzle, Prisma or `node-pg-migrate`). Keep only tables you use: `users`, `profiles`, `flashcards`, `flashcard_reviews`, `tests`, `test_attempts`, `notes`, `doubts`, `study_rooms`, `room_messages`, `forum_posts`, `revision_items`, `streaks`, `ai_usage`.
3. Add indexes on every `user_id` and on `(user_id, next_review_date)` for flashcards.
4. Add `helmet`, rate limiting, request logging (`pino`), and a real `/health` that checks the DB.
5. Deploy behind HTTPS with a process manager or container; keep secrets in the host's secret store.
6. Set up daily DB backups and test one restore.

### Exit criteria

- Zero data in local files; the server can be redeployed without losing state.
- p95 API latency under 300 ms for non-AI routes at 50 concurrent users (load-test with `k6` or `autocannon`).
- CI runs the full test suite on every push.

---

## Phase 2: Real retrieval and real AI (target: ~5,000 users)

**Trigger:** users ask for tutoring on their own notes, or AI answers are the main feature.

### Do

1. Replace keyword RAG with **embeddings**: `pgvector` in the same Postgres (simplest) or a dedicated vector store later. Chunk, embed and store per user, with `user_id` and `doc_id` filters.
2. Build an **AI gateway module**: one place for provider calls, model name from config, timeouts, retries, JSON-schema validation, prompt templates under version control.
3. **Stream tutor answers** (Server-Sent Events) so users see text immediately.
4. **Cache**: identical non-personal prompts (formula explanations, topic summaries) in Redis with a TTL.
5. **Cost controls**: per-user daily token budget from the `ai_usage` table, plus a global monthly cap and alert.
6. Replace the fixed 5-question test with a **question bank**: curated and reviewed questions stored in the DB, tagged by subject, topic and difficulty; use the model for variations, and verify generated answers before showing them.

### Exit criteria

- Answers cite retrieved sources from the user's own material only.
- AI spend per active user is measured and under your target.
- A provider outage degrades gracefully (clear message, no crash, no fake answers).

---

## Phase 3: Background work done properly (target: ~10,000 users)

**Trigger:** video analysis, document ingestion or bulk generation makes requests slow, or a deploy loses in-flight work.

### Do

1. Add **Redis** and a real job queue (**BullMQ**). Move video processing, document parsing, embedding and report generation into worker processes.
2. Persist job state in the DB; the API only enqueues and reports status. Retries with backoff, a dead-letter queue, and idempotent job handlers.
3. Run workers as a separate deployable so heavy jobs cannot starve the API.
4. Store uploads in **object storage** (S3 or compatible) with size and type limits and malware scanning; never serve them from the app disk.
5. Notify completion through the existing WebSocket or SSE channel.

### Exit criteria

- Killing a worker mid-job does not lose the job.
- API latency is unaffected while a large batch is running.

---

## Phase 4: Horizontal scale (target: ~50,000 users)

**Trigger:** CPU or memory on one API instance is consistently above ~60 percent, or you need zero-downtime deploys.

### Do

1. Make the API **stateless**: no in-memory sessions, caches that matter, or job state. Run 2 or more instances behind a load balancer.
2. **WebSocket scaling**: use Redis pub/sub (or a managed realtime service) so a message sent on instance A reaches users connected to instance B. Authenticate sockets and enforce room membership server-side.
3. **Postgres**: add a read replica for dashboards and leaderboards; use connection pooling (PgBouncer or the provider's pooler).
4. **Precompute heavy views**: leaderboard and productivity scores via scheduled jobs instead of per-request calculation.
5. Put static assets and the built frontend behind a **CDN**.
6. Add autoscaling rules and **graceful shutdown** (drain connections on `SIGTERM`).

### Exit criteria

- Rolling deploy with no dropped sessions.
- Load test at 3× expected peak passes with error rate under 1 percent.

---

## Phase 5: Operate it like a product (ongoing)

### Do

1. **Observability**: structured logs, metrics (request rate, latency, error rate, queue depth, AI latency and cost), traces, dashboards and alerts on SLOs.
2. **Security**: dependency scanning, secret rotation, audit log of admin actions (the `audit_logs` collection is a starting point), periodic access review, a basic threat model for the AI features (prompt injection, data leakage between users).
3. **Privacy and compliance**: data export and delete-account flows, retention rules for doubts and notes, parental-consent handling if minors use the product.
4. **Reliability**: define SLOs, run restore drills, write runbooks for the top 5 incidents.
5. **Product analytics**: feed real activity into streaks, productivity scores and revision priorities so the learning loop is driven by data, not seed values.

---

## Summary table

| Phase | Users (guide) | Main change | Key new component |
|---|---|---|---|
| 0 | tens | Prototype | none |
| 1 | ~1,000 | Safe single server, real DB | Postgres, CI, logging |
| 2 | ~5,000 | Real retrieval and AI | pgvector, AI gateway, cache |
| 3 | ~10,000 | Durable background work | Redis, BullMQ workers, object storage |
| 4 | ~50,000 | Horizontal scale | Load balancer, pub/sub, read replica, CDN |
| 5 | ongoing | Operations and compliance | Metrics, alerts, runbooks, audit |

---

## Rules of thumb

- **Measure before each phase**: load-test, find the real bottleneck, then fix that.
- **Keep each phase shippable**; do not start Phase 3 work on a Phase 0 database.
- **Every new component** (Redis, queue, vector store) needs an owner, a backup story and an alert before it goes live.
