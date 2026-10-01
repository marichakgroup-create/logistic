# LoadLink

Van freight planning: find a main load, add up to four compatible loads, save a trip and track manual booking status.

## Architecture

One Node application serves Next.js pages and `/v1` API routes on one port. PostgreSQL/PostGIS stores accounts,
orders, trips and cached road routes. Matching and periodic imports run inside the application.
No Redis, message queue, separate worker, API service or routing container is required.

## Local development

Node 22 and npm 10:

```sh
npm ci
cp .env.example .env.local
# Supply an existing PostgreSQL/PostGIS DATABASE_URL in .env.local.
node --env-file=.env.local --import tsx infra/migrate.ts
npm run dev
```

Alternatively, `docker compose up --build` starts the app and a local PostGIS database.
Open http://localhost:3000. Development sign-in accepts a valid email; production uses Google OAuth.
Local fixture routing is approximate. Production uses Google Routes or an optional existing OSRM endpoint.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

## Railway

Connect this repo's `main` branch to one Railway service. `railpack.json` supplies build and start settings; set the service healthcheck to `/v1/health`.
`npm start` migrates the existing database and starts the application. Push to main to deploy.
See [deployment settings](docs/RAILWAY.md) for required variables and Google OAuth callback.

The pilot currently imports fixture orders. Real feed integration and Stripe billing remain roadmap work.
LoadLink never books orders; carriers confirm them on trans.eu.
