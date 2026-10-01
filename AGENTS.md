# AGENTS.md — LoadLink (entry point for AI coding agents)

Read this file first. Then read the docs in the order below before writing code.

## What we are building
Web app (mobile-first PWA) for small van carriers (payload <= 2.5 t). The app imports open freight orders
from trans.eu (via our existing data feed), and lets a carrier build a **trip = 1 main order + up to 4 add-on
orders along the route**, auto-filtered by vehicle capacity, time windows and detour.
**We never book orders.** The carrier confirms on trans.eu; we only match, save, and track status.

## Read order
| # | File | Use it for |
|---|------|-----------|
| 1 | `docs/01-product.md` | Scope, user flow, business model, what is OUT of scope |
| 2 | `docs/02-matching-engine.md` | Core algorithm, defaults, pseudocode, tests |
| 3 | `docs/03-architecture.md` | Stack, services, workers, API contracts, env vars |
| 4 | `docs/04-data-model.md` | SQL schema (Postgres + PostGIS) |
| 5 | `docs/05-ui-spec.md` | Screens, components, UX rules, copy |
| 6 | `docs/06-roadmap.md` | Ordered tasks with acceptance criteria — **work from here** |

## Hard rules
1. **Scope lock:** implement only what `06-roadmap.md` lists for the current milestone. No extra features/menus.
2. **UX rule:** max 1 primary action per screen; mobile tab bar has exactly 3 items: Orders · Trips · Account.
3. **UI language:** English only. Currency EUR, distance km, weight kg, volume m³.
4. **Order source is an adapter** (`OrderSource` interface, see architecture). Never hardcode trans.eu specifics in core logic.
5. **Never auto-book or call trans.eu booking endpoints.** Only deep-link to `orders.trans_eu_url`.
6. **Cache every routing call** (`route_cache`). Never call routing inside a loop without cache.
7. **Conservative capacity:** use 95% of declared payload/volume. Unknown values => show "unknown", never assume 0.
8. **Every matching rule must have a unit test** (see `02-matching-engine.md` §7).
9. Keep functions small, typed (TypeScript strict), no dead code, no TODO without an issue reference.
10. If a spec is ambiguous, choose the simplest option, note it in `docs/DECISIONS.md` (create if missing), and continue.

## Stack (fixed for MVP)
Next.js 14+ (App Router, TS) · Tailwind + shadcn/ui · MapLibre GL · NestJS (TS) · PostgreSQL 16 + PostGIS ·
Single Node process · Google Routes (optional existing OSRM) · Stripe · Docker Compose for local development.

User-authorized simplification (2026-10-01): one Railway app, no Redis/BullMQ or separate workers.
Next.js and NestJS share one listener; imports run on an in-process timer. PostgreSQL is retained.

## Repo layout
```
/apps/web        Next.js frontend
/apps/api        Single application entry point, NestJS REST + Next.js server
/packages/core   Shared: matching engine, types, zod schemas (pure, no I/O)
/infra           docker-compose, OSRM data, migrations
/docs            This documentation
```

## Definition of done (every task)
Typecheck + lint pass · unit tests for logic · acceptance criteria in roadmap met · no console errors ·
mobile viewport (390 px) checked · migration included if schema changed.
