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
