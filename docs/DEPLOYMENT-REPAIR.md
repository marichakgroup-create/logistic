# Historical deployment repair

The split-service repair was superseded by the user-requested single application on 2026-10-01.
Use [RAILWAY.md](RAILWAY.md) for current setup. API proxy loops are eliminated by serving pages
and API on the same listener. No Redis or separate API/worker service is required.
