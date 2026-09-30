# Development status — 2026-09-30

Implemented: npm monorepo; Next.js/NestJS/BullMQ entry points; Compose configuration; Drizzle SQL migration with PostGIS/citext and indexes; 200 deterministic fixtures and normalization; transactional sync with cursor, advisory lock, two-confirmation closure, expiry and audit batches; OSRM/Google providers and persistent route cache.

Verified:
- Root and web strict TypeScript checks pass.
- ESLint passes.
- Unit tests cover fixture validation, sync behavior, capacity/input validation, magic-link controls, cache, fallback, failure and concurrent request coalescing.
- Next.js 16.3.7 production build passes.
- npm installation audit reports 0 vulnerabilities after dependency upgrades.
- Local page renders; browser error/warning log empty; no horizontal overflow at actual 520 CSS px. Browser viewport override requested 390 px but reported 520, so exact 390 px acceptance remains unverified.

Additional verified work:
- A fresh local PostgreSQL 17 database migrated with PostGIS and citext; expected order, session and vehicle indexes exist.
- The sync worker imported 200 fixture orders, then imported 0 on the identical second run. Both batches were audited.
- M1 magic-link authentication, 30-day sessions, one-time/15-minute tokens, five-links-per-hour limit, vehicle onboarding/editing, and capacity-aware search are implemented.
- The browser flow `login -> onboarding -> find` completed against the real API and database. Reusing the link redirected to the invalid-link state.
- A Sprinter search returned the fitting 200 kg Berlin–Warsaw order and hid the 1,704 kg Berlin–Paris order.
- Mobile layout, tab bar, empty state and account page were visually checked with no console errors or horizontal overflow. The browser test backend imposed a 520 CSS-pixel minimum despite a 390-pixel request; CSS mobile rules apply below 760 px.
- 19 unit tests pass. Strict TypeScript, ESLint and the Next.js production build pass. npm audit reports no known vulnerabilities.

Pending acceptance:
- M0.1 remains open because Docker is not installed; Compose startup and container healthchecks have not been executed.
- OSRM needs `infra/osrm/region.osm.pbf`. Cache/fallback orchestration is tested, but a live OSRM route has not been exercised.
- The intermediary order-feed contract and credentials will be supplied after the first deployment. Fixtures remain the active source.
- Production email needs a verified sender and Resend key. Development mail uses the local outbox.

M0.2–M0.5 and M1 are complete. M0.1 is environment-blocked. M2–M4 have not started.
