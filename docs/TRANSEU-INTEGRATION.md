# trans.eu integration preparation

## Transport boundary
LoadLink consumes the intermediary HTTP feed through `OrderSource`; it does not call trans.eu directly. The feed transport and payload contract are still pending. Keep fixture mode available without credentials and fail explicitly if an unconfigured feed is selected.

## Official documentation reviewed 2026-10-01
- [API portal](https://www.trans.eu/api/)
- [Get freights list](https://www.trans.eu/api/freights-section/get-freights-list-2/)
- [Get freight details](https://www.trans.eu/api/freights-section/get-freight-details/)
- [Register an application](https://www.trans.eu/api/register-your-app/)

The documented list endpoint returns non-accepted, non-archived freights created within the same company account, with a maximum page size of 30. It is not a general exchange search feed. Freight details can include accessible published freights, but this alone does not establish a bulk discovery contract.

Requests require a user access token (`Authorization: Bearer`) and an application `Api-key`. A single API key is not the complete authorization flow. These credentials belong to the intermediary integration and must never reach the browser.

## Required feed contract before implementation
1. Endpoint and authentication for incremental changes; cursor pagination and whether deletion/closure records are explicit.
2. Availability lookup for known source IDs, distinguishing closed from unavailable or unauthorized responses. Failed requests and omitted incremental records cannot close loads.
3. UTC pickup/delivery windows, coordinates, original deep-link, cargo weight/volume/dimensions, original price/currency, status and modification timestamp.
4. Weight in kg, dimensions in cm, volume in m³. Official freight capacity is tonnes: conversion belongs in the source adapter. Missing dimensions and quantities remain null. A missing price remains unknown; accepted_price is not a quoted open-order price. Non-EUR prices require an agreed conversion policy before becoming priceEur.
5. Idempotent replay, rate-limit/retry guidance and permission to store/display the supplied exchange data.

Multi-stop source freights need an explicit mapping policy: never silently reduce them to a pickup/delivery pair. No booking, acceptance, publication or negotiation endpoints are used by LoadLink.

## Development without credentials
Continue matching and trip management with deterministic fixtures. Validate source payloads at the adapter boundary once an actual contract is provided; credentials alone do not define that contract. Live integration and pilot acceptance remain M4.1.
