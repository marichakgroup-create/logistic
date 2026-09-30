# 06 — Roadmap (work in order; do not skip ahead)

Format: `[ ] ID — task` followed by acceptance criteria (AC).

## M0 — Foundation (week 1)
- [ ] M0.1 Monorepo + Docker Compose (web, api, worker, postgres+postgis, redis, osrm). AC: `docker compose up` starts all; healthchecks green.
- [ ] M0.2 Migrations from `04-data-model.md`. AC: fresh DB migrates; indexes exist.
- [ ] M0.3 `OrderSource` interface + `FixtureSource` (200 EU orders, realistic weights/windows) + `normalize()`. AC: fixtures normalize; tests pass.
- [ ] M0.4 `sync-orders` worker (upsert, mark closed after 2 missed syncs, audit log). AC: re-running is idempotent; closed orders flip status.
- [ ] M0.5 `RoutingProvider` (OSRM + cache + Google fallback). AC: same stops => cache hit; fallback used when OSRM down (tested with mock).

## M1 — Account & search (week 2)
- [ ] M1.1 Magic-link auth + session. AC: link single-use, expires in 15 min, rate-limited.
- [ ] M1.2 Vehicle presets + Onboarding screen. AC: signup to Find in < 60 s; payload validated <= 2500.
- [ ] M1.3 `GET /orders` + Find screen + cards. AC: hides orders exceeding vehicle capacity; shows "updated X min ago".

## M2 — Matching + Builder (weeks 3–4)
- [ ] M2.1 `packages/core/matching`: steps 1–7 of `02-matching-engine.md` with all tests in §7. AC: tests green; pure (no I/O).
- [ ] M2.2 `GET /orders/:id/addons` via match-worker, 5 min cache, `partial` flag. AC: p95 < 4 s on 10k open orders.
- [ ] M2.3 Trip Builder UI (map, sticky summary, Along-the-way, add/remove, show-all toggle). AC: adding recomputes list; cap 4; load bars correct.
- [ ] M2.4 `POST /trips` with server re-validation. AC: stale/over-capacity trip rejected with stable error code.

## M3 — Trips management (week 5)
- [ ] M3.1 Trip Detail + Open on trans.eu + Mark booked + derived trip status. AC: status rules in `04` §Derived hold.
- [ ] M3.2 Trips list with tabs + swipe cancel.
- [ ] M3.3 `notify` worker: email when an order in a saved trip becomes `lost`. AC: one email per order, banner appears in app.
- [ ] M3.4 Stripe trial/checkout/portal/webhook + paywall behavior. AC: trial expiry blocks Save/Add only.
- [ ] M3.5 Event logging for all types in `04`.

## M4 — Pilot (week 6)
- [ ] M4.1 Switch `ORDER_SOURCE=feed` with real data; verify legal terms (see `01-product.md`).
- [ ] M4.2 Onboard 5–10 carriers; review events dashboard (SQL view is enough).
- [ ] M4.3 Tune defaults (buffer, detour %, time buffer) from feedback. Record in `DECISIONS.md`.

## Backlog (v2, do NOT build now)
Multi-vehicle, multi-day planning, return loads, chat, auto-detect booking, native apps, broker ratings, invoices.
