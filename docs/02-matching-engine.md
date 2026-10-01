# 02 — Matching Engine (core feature)

Lives in `/packages/core/matching` as pure functions; I/O (DB, routing) injected via interfaces.

## 1. Inputs / outputs
```ts
suggestAddons(main: Order, trip: Trip, vehicle: Vehicle, pool: Order[], opts: MatchOpts): Suggestion[]

type MatchOpts = { bufferKm=25; maxDetourPct=0.15; maxDetourKm=40; costPerKm=0.45;
                   stopMinutes=30; timeBuffer=0.15; maxAddons=4; capacityFactor=0.95 }
type Suggestion = { order: Order; addedRevenue: number; detourKm: number; detourMin: number;
                    loadPctKg: number; loadPctM3: number|null; fit: 'green'|'yellow';
                    score: number; newEndTime: string }
```

## 2. Pipeline (run in this order; cheapest filter first)
1. **Status/time prefilter (SQL):** status=open; order windows overlap trip time span (+ buffer).
2. **Geo prefilter (PostGIS):** route polyline of current trip; keep orders where pickup AND delivery are within
   `bufferKm` of the line (`ST_DWithin` on geography) AND `ST_LineLocatePoint(pickup) < ST_LineLocatePoint(delivery)`
   (direction matches). Limit to 100 candidates ordered by added revenue.
3. **Insertion check (routing):** for each candidate, try valid insert positions (pickup before delivery,
   preserving existing order sequence). Take the cheapest by km. Use cached OSRM `table`/`route`.
   Reject if `detourKm > min(maxDetourPct * baseKm, maxDetourKm)`.
4. **Capacity check per leg (load profile):** after each stop compute onboard kg/m³; every leg must satisfy
   `kg <= payload*capacityFactor` and `m3 <= cargo_m3*capacityFactor`. Also check each cargo's L/W/H against vehicle
   interior if provided. Missing weight => reject; missing volume => allow but mark `loadPctM3=null` + yellow.
5. **Time feasibility:** simulate timeline: depart → drive (ETA * (1+timeBuffer)) → wait if early for window →
   service `stopMinutes` → check each window. Driver rules: <= 9 h driving/day, 45 min break per 4.5 h.
   If it needs > 1 day, reject in MVP.
6. **Score & sort:** `score = addedRevenue - detourKm * costPerKm`. Drop score <= 0. Sort desc.
   `fit = green` if load <= 85% and slack >= 30 min on all windows, else `yellow`.
7. Return top N. Cache result 5 min by key `hash(tripStops, vehicleId, opts)`.

## 3. Multi-add
After user adds B, rerun from step 2 against updated stops (greedy). Hard cap: `maxAddons`.
Removing an add-on recomputes everything from main.

## 4. Edge cases
- Main order itself exceeds vehicle capacity → hidden from Find results by default.
- Order disappears from source → `trip_orders.status='lost'`, trigger notify job.
- Same pickup/delivery point for several orders → allowed, stop service time shared (only one 30 min block).
- Timezones: store UTC, compute in order-local TZ for windows.
- Routing engine down → fallback provider; if both fail, return 503 with retry hint, never partial/wrong results.

## 5. Display metrics per suggestion
Badge: `+€120 · +8 km · fits 78%`. "Show all" toggle lists rejected orders greyed with reason enum:
`CAPACITY_KG | CAPACITY_M3 | DIMENSIONS | DETOUR | TIME_WINDOW | DIRECTION | DRIVER_HOURS`.

## 6. Performance
Geo prefilter in SQL with GiST indexes; routing calls batched and cached; max 100 candidates into step 3;
run inside the application with 4 s timeout, return partial ranked list flagged `partial=true` if exceeded.

## 7. Required unit tests
- Direction: add-on behind the main route is rejected.
- Capacity: sum fits only if delivery of A happens before pickup of B (load profile, not total).
- Capacity factor: load at 96% rejected.
- Time: window miss by 1 min rejected; early arrival waits.
- Detour limit boundary (equal accepted, +1 km rejected).
- 4 add-on cap. Missing volume => yellow, not rejected. Missing weight => rejected.
- Driver 9 h rule.
