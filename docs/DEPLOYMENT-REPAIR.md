# Railway deployment repair — 2026-10-01

## Findings

- The initial environment contained Web (`logistic`), Redis and `html-demo`; neither API nor Worker existed. Web starts only Next.js, so database variables on Web do not start the backend.
- Railway HTTP logs showed repeated Node requests to `/v1/auth/me` and `/v1/vehicles` on the Web domain, ending in 499/timeouts. This is consistent with API_URL pointing back to Web and recursively proxying requests. OAuth masks variable values, so the previous value could not be read through the connector.
- A successful frontend deployment did not validate backend connectivity. The public domain targets 8080 and Next.js listens on 8080, so the port is not the observed mismatch.

## Repair plan

1. Create private `api` and `worker` services from the existing repository. Build them with `infra/Dockerfile.backend`; start the correct workspace scripts.
2. API: run migrations before deployment, listen on IPv6 port 3001, use the existing database/session/Google credentials and Redis. Preserve disabled email for the Google pilot.
3. Worker: use the same database and Redis, import fixture orders and use cached OSRM/Google road routing.
4. Web: set API_URL to `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001` and rebuild; verify `/v1/health` through Web rather than checking only the login page.
5. Reject missing production API_URL and self-referencing frontend origins in both rewrites and server fetches. Cover the failure with regression tests.
6. Check public page, unauthenticated redirect, authentication endpoints, API/Worker runtime logs and mobile presentation after deployment.

## Local validation

Typecheck, lint, Web production build and seven deployment regression cases pass. The full existing suite has four unrelated failures: the old matching batching assertion and three TripService tests still passing suggestion arrays instead of validated TripPlan snapshots. These failures were already deferred in DECISIONS.md; they are not changed by this deployment repair.

No booking endpoints are called. The data source remains fixture until the feed contract and pilot requirements are fulfilled.
