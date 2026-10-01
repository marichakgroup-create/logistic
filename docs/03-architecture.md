# 03 — Architecture

User-authorized simplification, 2026-10-01. One repository, one Railway service and one Node process.

```text
Browser → single HTTP listener → Next.js pages / NestJS /v1 API → PostgreSQL + PostGIS
                                      API → direct matching → cached Google Routes / optional OSRM
                                      timer → order adapter → sync + pending notifications
```

`apps/api/src/main.ts` hosts both frameworks. `npm start` runs migrations before listening.
Matching uses a bounded five-minute memory cache and two concurrent calculations; fresh saves bypass it.
Road routes, sync state and notification records remain durable in PostgreSQL. Import runs immediately and
then one minute after each completion. Shutdown drains running work. Use one Railway replica.
See `RAILWAY.md` for deployment variables. Redis, BullMQ and separate API/worker services are removed.

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

## Environment and operations

`DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ROUTES_KEY`.
Optional: `APP_URL` (defaults to Railway domain), `OSRM_URL`, email configuration. `ORDER_SOURCE=fixture`
until feed integration is implemented. `PORT` is supplied by Railway. No `API_URL` or `REDIS_URL`.
Rate limits and user ownership checks remain in PostgreSQL. Only the app is publicly exposed.

### M2 draft route contract
`addonOrderIds` is a comma-separated, ordered selection of up to four unique IDs in GET queries. `trip` is the server-calculated snapshot of selected orders, stop order, timeline, peak load, total km, detour, revenue and road geometry. No `trip` in a partial timeout response means the draft is still unavailable for saving.

`POST /trips` requests a fresh plan-only in-process calculation and compares its input fingerprint against locked current order/vehicle rows. Route snapshots are stored in `trips.route_plan`. Map raster tiles are configurable with `NEXT_PUBLIC_MAP_TILE_URL`; the browser never calls a routing provider.

Matching responses can include `pending: true` when the API wait elapsed and the calculation is still running. A completed response can remain `partial: true` because of the candidate/time limit; it is not automatically retried. Builder polls only pending responses with a bounded retry count and aborts obsolete selections.
