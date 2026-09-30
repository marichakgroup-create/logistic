# LoadLink design system v2

This version supersedes the colors and visual tokens in `files/05-ui-spec.md`.

## Concept: The Route Line

One vertical line with meaningful nodes is the product's visual DNA. It connects origin and destination in search, cards, the builder, trip detail and loading states. It only represents an actual route.

## Brand and tokens

LoadLink uses a light operational canvas with high-visibility logistics accents: night navy surfaces, signal yellow, and a quiet light content sheet.

- `--night: #0D1B2A` — screen headers, maps and navigation.
- `--night-2: #16293F` — controls and raised content on night.
- `--sheet: #F1F3F6`; `--paper: #FFFFFF`.
- `--ink: #0D1B2A`; `--ink-2: #6B7A8C`.
- `--line: #E3E7EC`; dark line `#22364D`.
- `--signal: #FFCF33`; `--on-signal: #0D1B2A`.
- `--profit: #12803F`; `--warn: #C2410C`; `--danger: #D62839`.

Signal yellow may fill one primary action per screen and may draw the main route. It does not fill secondary controls.

## Type, shape and structure

Manrope is bundled locally and loaded through `next/font/local`, at weights 500, 600 and 800. Prices, totals and titles use weight 800 with tight tracking; data uses tabular numerals. Tiny section labels alone use uppercase.

Every product screen starts on a light canvas. Night surfaces are reserved for the route control, the single featured result, map and floating navigation. Content sheets use a 28 px top radius; cards use 20 px corners and no shadow. Fine borders separate adjacent light surfaces, while the only elevation shadow belongs to the floating three-item tab bar. Screen padding is 20 px on mobile and follows an 8 px grid.

## Components

- Find uses one `night-2` route control with two rows, connected nodes and an inline date.
- The first order is the larger inverted hero card. Remaining cards are paper. Cards have a route line, two city names, dominant price, rate and one plain cargo line.
- Builder candidates branch from the main route. Added branches become solid. Positive revenue uses profit green; tight capacity uses warn.
- Capacity uses two ten-segment gauges. Status is a colored node plus text without a badge.
- Maps use night styling, a 5 px signal main route and a 3 px dashed white add-on route.

Route lines draw over 400 ms. Add interactions fill a node and reflow over 200 ms. Reduced-motion preferences disable both.

Controls keep native keyboard, touch and operating-system behavior while using LoadLink chrome. Selects use a white 14 px surface and route-toned chevron; checkboxes use a squared 7 px node that fills signal yellow; disclosures use a divider and rotating chevron. Context help opens from a small squared question control into a dark tooltip. Dialogs use a 24 px paper surface and restrained elevation.

Tonal gradients are allowed only where they add depth to a functional focal surface: dark route controls, the featured result, vehicle/map art, and the primary signal action. Their endpoints remain close in luminance. Never use gradients as page backgrounds or decoration.

## Product rules

Keep the interface understandable to a driver without training, with Find, Trips and Account only. Each screen has one primary action. Do not add decorative chip rows, icon circles, bright multi-color gradients, blue defaults, equal-weight card stacks or stock illustrations.

The Behance Delivery Platform reference informs confidence, space, object-specific composition and consistent interaction. LoadLink keeps its own route-line concept, night/signal identity and freight workflow.
