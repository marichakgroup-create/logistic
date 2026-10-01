# Railway deployment

Deploy the web service from the repository root. Railpack builds `@loadlink/web` via `npm run build:web` and starts it with `npm start`. Next listens on `0.0.0.0` and the Railway-provided `PORT`.

Set `API_URL` on the web service to the separately deployed API URL, including during build because Next rewrites capture it. The default localhost API URL is only for development.

API and worker are separate services, not started by the web service. They require DATABASE_URL, REDIS_URL and the other environment values documented in 03-architecture.md. Neon configuration deployment does not deploy the Next frontend or apply application SQL migrations.
