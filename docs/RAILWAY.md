# Deploy LoadLink on Railway

One repository, three app services: `logistic` (Web), `api`, `worker`. Neon stores data; the existing `Redis` service runs the queue. A successful Web deployment alone cannot serve Find.

## One-time setup

1. Use Node 22, `npm ci`, and the latest Railway CLI. `railway login`, then `railway link` to the existing project / production environment under the correct account.
2. In Railway environment Shared Variables, set:

| Name | Value |
| --- | --- |
| DATABASE_URL | Neon production connection string with SSL (use direct/unpooled for migration session advisory locks) |
| SESSION_SECRET | A random secret at least 32 characters long |
| GOOGLE_CLIENT_ID | Google OAuth Web application client ID |
| GOOGLE_CLIENT_SECRET | Secret of the same OAuth client |
| OSRM_URL | Reachable self-hosted OSRM service URL |
| GOOGLE_ROUTES_KEY | Google Routes fallback key; empty if unused |

The Redis service must be named `Redis`; otherwise update its reference in `.railway/railway.ts`. The existing Web domain is reused. The API stays private; only Web needs a public domain.

3. Push the repository changes to main. Run `npm run deploy:plan`, review the changes, then `npm run deploy:apply`. Do not approve unexpected service/volume deletion. A named `loadlink` partial manages only app services, leaving existing Redis and demo outside its ownership. Inspect the first plan before applying, including variable removals on Web.
4. API runs `npm run migrate` automatically before deployment. Start API first, then Worker, then rebuild Web with its API reference. Workers can be redeployed after API migration finishes on first installation.
5. Visit `/find`: without a session it should redirect to `/login`; choose Continue with Google.

## What the configuration supplies

| Service | Build | Start | Extra |
| --- | --- | --- | --- |
| logistic | Railpack: npm run build:web | npm start | API_URL automatically references private API; /login healthcheck |
| api | infra/Dockerfile.backend | npm run start:api | Port 3001, IPv6 private networking, /v1/health, migrations |
| worker | infra/Dockerfile.backend | npm run start:worker | Redis, cached road routing, fixture orders until feed contract exists |

`APP_URL` is automatically the Web HTTPS domain. Never point `API_URL` to Web itself. Railway supplies Web PORT. Database/Redis/email secrets are only used by API/Worker.

## Missing providers

Production sign-in uses Google OAuth. Email sending is disabled, including lost-order emails; in-app lost-order status remains. Resend is not required for this setup. Local outbox is development only. Routing must have an actual OSRM service or working Google fallback; production fixture routing is forbidden. Trans.eu and Stripe keys are not required for this fixture pilot.

`neon deploy` does not apply LoadLink migrations or host the frontend. Never commit `.env.local`, `.neon`, or credentials. Rotate the Neon password disclosed in chat before deployment.

## Diagnosis

- Web online + Find 500: check API deployment and API_URL; a /login healthcheck validates only Web.
- API pre-deploy failure: inspect migration logs, Neon permissions and PostGIS availability.
- Email cannot send: inspect Resend key, verified sender and APP_URL.
- No matches: confirm Worker is online, Redis reference resolves and routing is reachable.

IaC is applied explicitly via CLI; Git push rebuilds existing services but does not create missing infrastructure. Reference: https://docs.railway.com/infrastructure-as-code

## Google sign-in setup

Google Cloud → Google Auth Platform: configure branding and audience (External; add your email as a test user while in Testing). Credentials → Create OAuth client ID → Web application. Add this Authorized redirect URI exactly:

`https://logistic-production-c186.up.railway.app/v1/auth/google/callback`

Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Railway Shared Variables, then deploy API. Routes API keys are separate and cannot authenticate users. No Google access/refresh tokens are persisted. Google subject is unique; verified Gmail/Workspace identity can link an existing email account, third-party emails cannot silently link an existing account.

Database, Redis, SESSION_SECRET and API/Worker services are still required; changing the login provider does not remove them. Apply migration 0004 before using Google sign-in.
