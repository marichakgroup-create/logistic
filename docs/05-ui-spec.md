# 05 — UI Spec (English UI, mobile-first, minimal)

## Design tokens
Font: Inter. Background white / #0B0F14 (auto dark). One accent: blue #2563EB. Status: green #16A34A,
amber #D97706, red #DC2626. 8-px grid. Radius 12. Tap targets >= 44 px. No sidebars, no modals except confirm-delete.
Components: shadcn/ui (Button, Card, Input, Tabs, Badge, Progress, Sheet). Icons: lucide.
Bottom tab bar (mobile) / top bar (desktop): **Find · Trips · Account** only.

## Rules
1. One primary button per screen (accent filled). Everything else ghost/text.
2. No settings inside the flow; defaults everywhere (25 km buffer, EUR 0.45/km).
3. Numbers first: price, km, fit % are the largest text on cards.
4. Skeleton loaders, never spinners blocking the page. Show "Updated 2 min ago" on lists.
5. Empty states always suggest one action.

## Screens
### S1 Onboarding
Email field → [Send link] → "Check your inbox". Callback → **"Your van"**: preset chips (Sprinter, Crafter, Ducato,
Transit, Master, Vito, Custom) auto-fill payload kg, m³, L×W×H (editable) → [Start]. Then 14-day trial banner (small, dismissable).

### S2 Find (home)
Fields: From, To (autocomplete, country flags), Date (default today+1). Below: order cards.
Card: `Berlin → Warsaw` · date · `€1,050 · 580 km · €1.81/km` · `850 kg · 4.2 m³` · [chip: Fits your van].
Tap card → Trip Builder. Sort: €/km (default) | price | pickup date. No other filters.

### S3 Trip Builder (core screen)
- Map top (40% height): main route in blue, add-ons in amber, stops numbered.
- Sticky summary bar: `€1,260 · 640 km · +12 km detour · Load 78% · Ends Tue 16:40` + two thin progress bars (kg, m³).
- Section **"Along the way"**: cards `+€210 · +8 km · fits 78%`, pickup→delivery mini text, fit dot (green/amber), [+ Add].
  After add: card moves to "In your trip" with [Remove]; list refreshes.
- Footer toggle: "Show orders that don't fit" → greyed cards with reason text.
- Sticky bottom CTA: **[Save trip]** (primary). Max 4 add-ons; afterwards show "Trip is full".

### S4 Trip Detail
Vertical timeline of stops with times. Per order row: title, price, status badge, [Open on trans.eu] (opens new tab),
then [Mark as booked] appears after returning to the app (or always visible as secondary). Header: "2 of 3 booked" progress.
Red banner if an order is `lost`: "Order no longer available" + [Find replacement] (opens Builder with the same main and a fresh list).
Menu (…) only: Cancel trip.

### S5 Trips
Tabs Planned · Booked · Done. Row: route summary, date, total €, `2/3 booked`. Swipe left = cancel (confirm).

### S6 Account (single page)
Vehicle (edit fields), Cost per km, Detour limit (km slider 10–50), Plan & billing (Stripe portal link), Log out.

## Paywall
After trial: Find and Builder remain viewable, [Save trip] and [+ Add] show "Subscribe to continue" (single Stripe Checkout button).

## Copy (keep short)
Buttons: Send link · Start · Add · Remove · Save trip · Open on trans.eu · Mark as booked · Subscribe.
Fit reasons: "Too heavy" · "Too bulky" · "Too far off route" · "Misses time window" · "Wrong direction" · "Driving limit".

## Accessibility & perf
Contrast AA, focus states, labels on inputs, prefers-reduced-motion. LCP < 2.5 s on 4G. Map loads lazily.
