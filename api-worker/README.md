# watchpapa API Worker

Cloudflare Worker backend scaffold for `api.watchpapa.tv`.

## Files

- `src/index.js` - Hono app with route stubs:
  - `GET /health`
  - `GET /api/search`
  - `POST /api/resolve`
  - `POST /api/inject`
- `wrangler.jsonc` - Worker config for deploy/dev
- `.dev.vars.example` - local env template

## Local development

1. Install dependencies:
   - `npm install`
2. Create local vars file:
   - copy `.dev.vars.example` to `.dev.vars`
   - fill real values
3. Start worker locally:
   - `npm run dev`

## Deploy

- `npm run deploy`

Then in Cloudflare dashboard:

1. Set production secrets for all keys from `.dev.vars.example`.
2. Add route `api.watchpapa.tv/*` to this worker.
3. Verify:
   - `GET https://api.watchpapa.tv/health`
   - `GET https://api.watchpapa.tv/api/search?q=test`

## Next implementation step

Port existing route logic from:

- `Backend/src/routes/search.js`
- `Backend/src/routes/resolve.js`
- `Backend/src/routes/inject.js`
- `Backend/src/services/searchService.js`

into worker-compatible handlers.
