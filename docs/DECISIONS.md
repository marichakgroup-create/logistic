# Implementation decisions

- Start with M0 only, following milestone scope lock. M1–M4 remain pending.
- Use npm workspaces and Drizzle SQL migrations (explicit PostGIS SQL).
- Incremental fetch omissions are not closure signals. Poll fetchClosedIds for all open IDs; increment misses only after successful availability checks. Close after two consecutive positive checks.
- Fixture source uses a stable configurable epoch and deterministic IDs; it never requires external credentials.
- Unknown cargo values stay null. Source-specific names remain in adapters/database mapping.
- OSRM requires a prepared extract. Supply a small reproducible Berlin-region extract for development; a Europe extract is a deployment prerequisite.
- Missing routing credentials or both providers failing produce an explicit unavailable error; no straight-line substitute.
- Initial page is a foundation placeholder, not the M1 search interface.

# Questions before later milestones

- Existing feed transport, payload schema, cursor semantics and availability semantics?
- Sender/domain and email provider for magic links?
- Stripe price and hosting region? Partner permission must be confirmed before M4 launch.

# Confirmed by the user — 2026-09-30

- The order source will be an intermediary HTTP API to reduce requests to trans.eu. LoadLink never calls trans.eu directly. Its contract remains pending; do not invent third-party endpoint shapes.
- First deployment uses fixtures. Real data integration follows provider setup after deployment.
- The user requested continuing the roadmap; current implementation milestone is M1, with environment-dependent M0 acceptance checks tracked separately.
- Canonical GitHub repository: https://github.com/marichakgroup-create/logistic (empty when connected).
- M1 adds account session/logout and vehicle editing necessary for its flows. Trips tab is a milestone placeholder; no M2/M3 trip behavior is implemented yet.
- Search dates are UTC calendar days for now; timestamp values remain UTC. City autocomplete uses imported addresses, not a third-party geocoder.
- Vehicle presets are editable starting values, not certified specifications of every trim. Operators confirm dimensions and payload.
- Local email writes development-only outbox files; production requires Resend credentials and verified sender. Links are never returned in API responses.

# Design direction v2 — 2026-09-30

- The user-approved Route Line system supersedes the visual colors and tokens in `files/05-ui-spec.md` and the earlier blue direction.
- LoadLink is light-first. Night navy is reserved for structural components, signal yellow marks one primary action plus the main route, and Manrope, a single inverted hero card and a floating three-tab bar provide the visual identity.
- The Behance Delivery Platform reference informs scale, space and bespoke logistics composition. LoadLink retains its own information architecture and route-first workflow.
- Full guidance lives in `docs/DESIGN-v2.md` and applies to all current and future screens.
- Restrained same-hue gradients may add depth to functional focal surfaces. Native select, date and form behavior stays intact beneath branded controls so touch and keyboard interaction remain predictable.
- Do not create custom illustrative SVG artwork. User-provided or generated assets are the only product imagery; universal control icons remain allowed.
- `FixtureRouting` is deterministic local-development infrastructure only. Production continues to require OSRM with Google Routes fallback and never substitutes estimated straight-line routing.

## 2026-09-30 — Operational UI refinement
- Preserve the approved LoadLink workspace (white canvas, navy, signal yellow, Manrope) and the three-item navigation. This user-requested design refinement follows existing M1–M3 UI scope.
- Use one shared 8/16/24/32 spacing rhythm, full-width sidebar rows, horizontal local navigation and progressively disclosed dimensions. Remove decorative workflow steps and repeated navigation help.
- Use native auto popovers for custom sorting and calendar controls (Escape/outside dismissal); CSS anchors place them next to their triggers where supported, with a centered fallback. City suggestions use a keyboard-operable combobox.
- Keep pickup/delivery windows visible on freight cards and delivery deadlines on saved loads. Unknown volume/distance is explicitly labeled.

## 2026-10-01 — M2 selection recalculation and deferred testing
- The user explicitly requested implementation now and comprehensive tests only on their later instruction. No test runs or new tests were performed for this increment; acceptance remains pending. TypeScript compilation is retained as a minimal implementation check.
- `addonOrderIds` is an ordered draft selection (up to four unique UUIDs). Every add/remove reconstructs the route greedily from the main load, queries the current route corridor, and reranks remaining candidates. The cumulative detour limit is relative to the original main route.
- Choose the shortest insertion that satisfies capacity and time feasibility, rather than rejecting an order after checking only the shortest geometric insertion. A trip lasting over 24 hours is outside the MVP.
- Capacity metrics are peak onboard kg/m³ per route leg. Unknown volume is retained as null. Timeline returns arrival/departure times and onboard cargo after every stop.
- Save requests bypass the suggestion cache and calculate the complete selected route. Order and vehicle fingerprints are compared under database share locks before the transaction commits. Cached suggestions alone are no longer accepted as proof that a whole trip is feasible.
- Persist the server route snapshot in nullable `trips.route_plan` (migration 0003); existing trips retain their previous detail view. New trip distance/end time come from the route calculation, not the sum of individual detours or the last delivery-window deadline.
- MapLibre is lazy-loaded; configurable raster tiles use `NEXT_PUBLIC_MAP_TILE_URL`. OSRM/Google polylines supply road geometry. Development fixture routing supplies no road geometry: show numbered stops with an explicit missing-road-line label, never invent a road route. Fixture routing is rejected in production.
- M2 candidate routing is capped at 100 orders. The existing 10k/p95 benchmark, new selection/save regression cases, map/browser acceptance and updates to legacy TripService test fixtures are reserved for the deferred test phase.

## 2026-10-01 — Bounded matching and feed preparation
- Continue M2.2 before live-feed pilot integration. Public trans.eu documentation does not establish the intermediary feed contract; record preparation in TRANSEU-INTEGRATION.md rather than inventing exchange discovery endpoints.
- Evaluate candidates in revenue-prefilter order, one candidate's insertion batch at a time. Deadline is checked between complete candidates after 3.5 seconds from job execution; the first candidate may exceed the budget. Routing failure still fails the calculation instead of returning an invalid route.
- Route legs use at most eight concurrent cached provider requests per planner call. Worker publishes only fully evaluated suggestions and a validated selected-trip snapshot to BullMQ progress. At API timeout return this snapshot if available, marked partial; otherwise retain an empty pending response.
- A queued job's wait includes queue delay; progress can therefore still be unavailable at timeout. The 10k/p95 target and regression tests remain unverified until the user requests testing.

## 2026-10-01 — Builder follows worker progress
- `pending` distinguishes a still-running matching job from a completed but partial corridor search. Builder polls pending jobs every 1.5 seconds, at most ten responses per selection, and keeps ready suggestions usable during background calculation.
- Stop polling completed partial results; show the incomplete-search notice instead. Abort requests and cancel scheduled polls when selection changes or the component unmounts. Clear the previous route immediately on a new selection so stale totals/map are not presented as the current draft.
- Typecheck passed; tests and browser acceptance remain deferred by user.

## Google sign-in pilot — user-requested scope change
- User requested Google login instead of email setup. Production login screen uses Google; email provider is disabled for the pilot, with no lost-order email delivery. Existing email and local development routes remain.
- OAuth authorization code + PKCE, signed ten-minute state/nonce cookie, Google SDK ID-token verification, unique Google subject, and conservative existing-account linking. Migration 0004 adds users.google_sub. OAuth secrets remain server-only.
- Google OAuth credentials are still needed to activate login; a Routes API key cannot replace them. Tests remain deferred by user.
