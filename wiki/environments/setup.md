# Local Setup

## Requirements

* Node.js 20 or newer.
* npm, which ships with Node.
* The backend, `LXTranslator/server-expressjs`, running locally if you want the
  application to do anything beyond render. It needs no configuration of its own.

## First run

```bash
npm install
npm run dev
```

The dev server listens on `http://localhost:5173` and proxies `/api` to
`http://localhost:4000`, so the browser sees a single origin and no cross origin rules
enter the development path. Start the backend alongside it:

```bash
# in a clone of server-expressjs
npm install && npm start
```

No configuration is required for either side. If your backend listens somewhere else, set
`VITE_API_PROXY_TARGET` — see [`env.md`](env.md).

## Commands

```bash
npm run dev             # dev server with hot module replacement, port 5173
npm run build           # production bundle into dist/
npm run preview         # serve the built bundle locally
npm test                # full Vitest suite
npm run test:watch      # watch mode
npm run test:coverage   # with coverage
npm run audit:security  # npm audit, fails at high severity
```

`npm test` runs against jsdom and needs no configuration, no running backend and no
network. If it needs any of those, something has been mocked incorrectly.

## Project layout

`src/main.jsx` mounts React, the router and the session provider. `src/App.jsx` holds the
route table. Pages live in `src/pages/`, one per route; components in `src/components/`;
framework free helpers in `src/lib/`. The style layers in `src/styles/` are imported in a
fixed order by `main.jsx` and that order matters.

The full picture is in [`../information/architecture.md`](../information/architecture.md).

## Tests

Vitest with Testing Library, configured inside `vite.config.js` rather than a separate
file. Render through `tests/helpers/renderWithProviders.jsx` so the router and session
provider are present, and mock `src/lib/apiClient.js` rather than `fetch` — mocking
`fetch` bypasses the error shaping the components depend on.

## Building for deployment

```bash
npm run build
```

Output lands in `dist/` as static files with hashed asset names. Source maps are
deliberately omitted so the original sources are not published alongside the bundle.
Serving that output is described in [`docker.md`](docker.md).
