# LoadLink

Mobile-first van freight planning app. The foundation, account/search, matching, trip saving and core trip management flows are implemented; progress and remaining acceptance work are tracked in `docs/STATUS.md` and `docs/06-roadmap.md`.

## Local checks

Node.js 22+ and npm 10+:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run dev --workspace=@loadlink/web
```

For the complete local flow, run the API and web app with `DATABASE_URL`, `APP_URL`, and a 32+ character `SESSION_SECRET`. Development magic links are written to `.local/mail` and never returned by the API. Production requires `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, and a verified `EMAIL_FROM` sender.

To sign in locally, submit any valid email on `/login` and press **Sign in**. The development-only endpoint creates the local session immediately and is disabled in production. `npm run mail:latest` remains available when testing the magic-link flow itself.

## Containers

Install Docker Compose. Place a regional OSM extract at `infra/osrm/region.osm.pbf` (see that directory's README), then:

```sh
docker compose up --build -d
docker compose ps
curl http://localhost:3001/v1/health
```

Migration runs before API/worker. Fixture worker imports 200 deterministic orders. Configure `FIXTURE_EPOCH` in the worker environment for a future fixture date when needed. This is a development stack; production secrets, TLS and monitoring are later deployment work.

Routing clients and cache live in `packages/services`. Orders come from the fixture adapter until the intermediary HTTP feed contract is supplied. LoadLink does not call trans.eu directly and has no booking integration.

See docs/DECISIONS.md for assumptions and docs/STATUS.md for verified checks.
