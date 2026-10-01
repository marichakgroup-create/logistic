# 01 — Product

## Positioning
"Pick one route. We show what fits on the way."
Target: owner-operators, 1–3 vans, payload <= 2.5 t. Used mostly on a phone.

## Business model (MVP)
- Subscription per vehicle: EUR 29–49 / month, 14-day free trial, Stripe.
- No success fee (booking happens on trans.eu, cannot be enforced).
- Later: premium alerts, multi-day trips.

## KPIs (log as `events`)
trial→paid conversion · trips saved / user / week · % trips with >=1 add-on · extra EUR per trip.

## User flow ("the corridor")
1. **Sign up** — email magic link → "Your van" (preset picker, 3 editable fields) → Find. Target < 60 s.
2. **Find** — From → To + date. Result = order cards (main route candidates).
3. **Trip Builder** — tap an order = main route. "Along the way" list shows only orders that fit. Tap + to add.
   Sticky summary: total EUR, km, detour km, load % (kg and m³), end time.
4. **Save trip** — one button. Trip detail = checklist of orders, each with [Open on trans.eu].
5. **Mark booked** — after confirming on trans.eu the user taps [Booked] per order.
   Trip status: planned → booked (all booked) → done.
6. **My Trips** — Planned / Booked / Done.

## Scope
**IN:** magic-link auth, 1 vehicle (schema supports many), order import, search, main + <=4 add-ons,
matching (geo + capacity + time + detour), trip save, manual booking status, order-expiry alerts, Stripe.

**OUT (v2):** multi-day/multi-vehicle planning, return loads, chat, auto-detect booking, native apps,
broker ratings, invoices/documents, success fees.

## Non-functional
GDPR, TLS, EU hosting, rate limiting. Order data must show "updated X min ago". Search p95 < 1.5 s;
add-on suggestions p95 < 4 s (cached 5 min).

## Legal blocker (check before launch)
Confirm trans.eu partner/API terms allow storing orders, showing them to third parties, and deep-linking.
