# Deploy LoadLink on Railway

One GitHub repository → one Railway application service (`logistic`) → existing PostgreSQL/PostGIS database.

## Configuration

Connect `marichakgroup-create/logistic`, branch `main`, repository root `/`.
`railpack.json` defines build (`npm run build`) and start (`npm start`). Set the Railway healthcheck to `/v1/health` with a 180-second timeout.
Each push to main rebuilds this service. No infrastructure CLI or separate API/worker deployment is needed.
`npm start` applies pending migrations with an advisory lock, then starts one Node process on Railway's `PORT`.
Next.js handles pages and assets; Nest handles `/v1` in that same process. Server components call the local listener.

Set these variables directly on `logistic` (or reference environment shared variables):

| Variable | Value |
| --- | --- |
| DATABASE_URL | Existing PostgreSQL connection with PostGIS; direct endpoint for session migration locks |
| SESSION_SECRET | Random secret, at least 32 characters |
| GOOGLE_CLIENT_ID | Google OAuth web client ID |
| GOOGLE_CLIENT_SECRET | Matching OAuth client secret |
| GOOGLE_ROUTES_KEY | Google Routes API key for road distances and geometry |
| NODE_ENV | production |
| EMAIL_PROVIDER | disabled |
| ORDER_SOURCE | fixture until the real feed adapter is available |

`APP_URL` defaults to HTTPS plus `RAILWAY_PUBLIC_DOMAIN`; set it explicitly for a custom domain.
`OSRM_URL` is optional for an existing routing provider. No routing container is required.
`API_URL` and `REDIS_URL` are unused and can be removed. Keep one replica.

Google authorized redirect URI:
`https://logistic-production-c186.up.railway.app/v1/auth/google/callback`

## Runtime

- Direct matching, two concurrent calculations, five-minute bounded memory cache; cache loss on restart is harmless.
- Road routes cached durably in PostgreSQL. Saving always recalculates and validates against current locked records.
- Order sync runs on startup, then every minute after the previous run completes. Failures are logged and retried.
- Pending notifications live in PostgreSQL and are delivered when email is configured. Disabled email keeps in-app alerts.
- Graceful shutdown waits for active work; restart resumes from stored sync/notification state.
- Healthcheck queries the database. Authentication and road routing must also be verified separately.

## Migration from the former split deployment

Deploy and verify `logistic` first, then stop/remove the old `api`, `worker`, and Redis services.
The database must be retained. Do not reference credentials through services that will be removed.

## Pilot limits

The imported orders are fixtures, not live trans.eu loads. Real-feed integration and Stripe billing remain unfinished.
Production forbids approximate fixture routing. Missing/invalid routing credentials return a retryable error rather than invent road distances.
Google OAuth and Google Routes are separate credentials. No booking requests are sent to trans.eu.
