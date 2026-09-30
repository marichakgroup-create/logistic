# Development status — 2026-09-30

Implemented: npm monorepo; Next.js/NestJS/BullMQ entry points; Compose configuration; Drizzle SQL migration with PostGIS/citext and indexes; 200 deterministic fixtures and normalization; transactional sync with cursor, advisory lock, two-confirmation closure, expiry and audit batches; OSRM/Google providers and persistent route cache.

Verified:
- Root and web strict TypeScript checks pass.
- ESLint passes.
- Unit tests cover fixture validation, sync behavior, capacity/input validation, magic-link controls, cache, fallback, failure and concurrent request coalescing.
- Next.js 16.3.7 production build passes with locally bundled Manrope.
- npm installation audit reports 0 vulnerabilities after dependency upgrades.
- Local page renders; browser error/warning log empty; no horizontal overflow at actual 520 CSS px. Browser viewport override requested 390 px but reported 520, so exact 390 px acceptance remains unverified.

Additional verified work:
- A fresh local PostgreSQL 17 database migrated with PostGIS and citext; expected order, session and vehicle indexes exist.
- The sync worker imported 200 fixture orders, then imported 0 on the identical second run. Both batches were audited.
- M1 magic-link authentication, 30-day sessions, one-time/15-minute tokens, five-links-per-hour limit, vehicle onboarding/editing, and capacity-aware search are implemented.
- The browser flow `login -> onboarding -> find` completed against the real API and database. Reusing the link redirected to the invalid-link state.
- A Sprinter search returned the fitting 200 kg Berlin–Warsaw order and hid the 1,704 kg Berlin–Paris order.
- Mobile layout, tab bar, empty state and account page were visually checked with no console errors or horizontal overflow. The browser test backend imposed a 520 CSS-pixel minimum despite a 390-pixel request; CSS mobile rules apply below 760 px.
- M2.1 pure matching is implemented with batched insertion-route planning, per-leg load profiles, conservative capacity, time-window simulation, driver breaks/hours, detour limits, scoring and fit status.
- 35 unit tests pass, including every required matching case in `02-matching-engine.md` §7, deterministic development routing and route-leg deduplication. Strict TypeScript, ESLint and the Next.js production build pass. npm audit reports no known vulnerabilities.
- Design system v2 is implemented across Find, Trips and Account: night/signal tokens, Route Line motif, content sheet, one featured route card, floating three-tab navigation and locally bundled Manrope. Find was visually checked in the live browser.
- M2.2 now has an authenticated `GET /orders/:id/addons` endpoint, BullMQ match worker, PostGIS corridor prefilter, exact core re-validation, five-minute completed-job cache and timeout/candidate-limit `partial` behavior.
- The complete local queue flow returned HTTP 200 in 0.205 s; a repeated identical request hit the cache in 0.031 s.
- The guided Find flow now takes a first-time user from a fitting main load into the Trip Builder. The builder has capacity gauges, safe add-on selection, a four-order cap, a sticky value summary and direct save flow.
- M2.4 server re-validation is complete. Saving rejects stale or over-capacity selections with stable conflict codes and creates the trip, its ordered loads and audit event in one transaction.
- M3.1 Trip Detail is complete with trans.eu links, per-load booking actions and derived Planned / Booked / Done status.
- M3.2 Trips is complete with Planned / Booked / Done tabs, status-aware light cards, guarded cancellation and swipe-to-reveal cancellation on touch screens. Cancellation is transactional.
- The live browser flow `Find -> Builder -> Save -> Trip detail -> Mark booked -> Trips` was verified against PostgreSQL and Redis.
- M3.3 Lost-order protection is complete. Sync marks unavailable pending trip orders as Lost, creates a unique notification record per order, and the worker delivers or records a retryable failure. Trip Detail shows the verified replacement alert and removes booking actions from lost loads.
- The current suite has 43 passing tests. Strict TypeScript, ESLint and the Next.js production build pass.

Pending acceptance:
- M0.1 remains open because Docker is not installed; Compose startup and container healthchecks have not been executed.
- OSRM needs `infra/osrm/region.osm.pbf`. Cache/fallback orchestration is tested, but a live OSRM route has not been exercised.
- M2.2 still needs its 10,000-open-order p95 benchmark before its roadmap acceptance criterion is complete.
- M2.3 still needs the lazy route map, show-all control and re-ranking after each selected add-on before its full acceptance criterion is complete.
- The intermediary order-feed contract and credentials will be supplied after the first deployment. Fixtures remain the active source.
- Production email needs a verified sender and Resend key. Development mail uses the local outbox.

M0.2–M0.5, M1, M2.1, M2.4 and M3.1–M3.3 are complete. M0.1 is environment-blocked. M2.2 is implemented and awaiting its 10k p95 benchmark. M2.3 is partially implemented. M3.4 is next.
