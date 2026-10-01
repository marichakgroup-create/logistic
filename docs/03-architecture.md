# 03 — Architecture

```
trans.eu data feed ─▶ OrderSource adapter ─▶ [sync-orders worker] ─▶ Postgres/PostGIS ◀─▶ API (NestJS) ◀─▶ Web (Next.js PWA)
                                                                        ▲                      │
                                          OSRM (+Google fallback) ◀─ route_cache ◀─ [match-worker] ◀─ Redis/BullMQ
                                                                                   [notify worker] ─▶ email (Resend/SES)
Stripe ◀─▶ API webhooks
```

## Services
- **web:** Next.js App Router, server components for lists, client components for Trip Builder + map. PWA manifest.
- **api:** NestJS REST, zod-validated DTOs (shared from `/packages/core`). Session cookie (httpOnly, SameSite=Lax).
- **worker:** `sync-orders` (every 60–300 s), `match` (on demand), `notify` (event-driven), `expire-orders` (hourly).
- **routing:** OSRM container (Europe extract, car profile; van parameters not needed in MVP). Fallback: Google Routes API behind `RoutingProvider` interface.
- **db:** Postgres 16 + PostGIS; migrations via Prisma/Drizzle (pick one, record in DECISIONS.md).
- **auth:** passwordless magic link (token TTL 15 min, single use) → session 30 days.
- **billing:** Stripe Checkout + Customer Portal; webhook updates `users.plan`, `plan_status`, `trial_ends_at`.

## Adapter interface (isolates trans.eu)
```ts
interface OrderSource {
  fetchSince(cursor: string | null): Promise<{ orders: RawOrder[]; nextCursor: string }>;
  fetchClosedIds(ids: string[]): Promise<string[]>;   // to detect disappeared orders
}
function normalize(raw: RawOrder): Order;              // pure, tested with fixtures
```
Implementations: `TransEuFeedSource` (reads our existing system DB/API), `FixtureSource` (local dev, 200 fake EU orders).

## API (REST, JSON, prefix /v1)
| Method | Path | Notes |
|---|---|---|
| POST | /auth/magic-link | `{email}` |
| GET | /auth/callback?token | sets session |
| GET/PUT | /vehicles | list / upsert (MVP: one default) |
| GET | /orders | `from,to,date,vehicleId,cursor` → cards; hides orders not fitting vehicle |
| GET | /orders/:id | detail |
| GET | /orders/:id/addons | `vehicleId,bufferKm,tripId?,addonOrderIds?` → `{suggestions[], rejected[], trip?, partial, updatedAt}` |
| POST | /trips | `{vehicleId, mainOrderId, addonOrderIds[]}` → re-validates server-side |
| GET | /trips | `status?` |
| GET | /trips/:id | with stops timeline + metrics |
| PATCH | /trips/:id | add/remove add-on, cancel |
| PATCH | /trip-orders/:id | `{status: 'booked'|'dropped'}` |
| POST | /billing/checkout, /billing/portal, /billing/webhook | Stripe |

Errors: `{error: {code, message}}`; codes stable (`ORDER_GONE`, `CAPACITY_EXCEEDED`, `TRIAL_EXPIRED`, …).
**Server always re-validates** a trip on save (orders still open, capacity, time) — never trust client.

## Env vars
`DATABASE_URL, REDIS_URL, SESSION_SECRET, OSRM_URL, GOOGLE_ROUTES_KEY, ORDER_SOURCE (feed|fixture),
TRANSEU_FEED_URL, TRANSEU_FEED_TOKEN, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, EMAIL_API_KEY, APP_URL`

## Ops
Docker Compose for dev/prod-lite (web, api, worker, postgres, redis, osrm). Healthchecks, structured JSON logs,
Sentry. Audit log for every sync batch (counts in/updated/closed). Rate limit: 60 req/min/user, 5 magic links/hour/email.
Data access: users can only read their own vehicles/trips; orders are shared read-only.

### M2 draft route contract
`addonOrderIds` is a comma-separated, ordered selection of up to four unique IDs in GET queries. `trip` is the server-calculated snapshot of selected orders, stop order, timeline, peak load, total km, detour, revenue and road geometry. No `trip` in a partial timeout response means the draft is still unavailable for saving.

`POST /trips` requests a fresh plan-only worker job and compares its input fingerprint against locked current order/vehicle rows. Route snapshots are stored in `trips.route_plan`. Map raster tiles are configurable with `NEXT_PUBLIC_MAP_TILE_URL`; the browser never calls a routing provider.

Matching responses can include `pending: true` when the API wait elapsed and the worker is still running. A completed response can remain `partial: true` because of the candidate/time limit; it is not automatically retried. Builder polls only pending responses with a bounded retry count and aborts obsolete selections.
