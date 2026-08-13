---
name: agent-wiki-context-repository-map
description: Orientation for an agent working in client-reactjs — what lives where, the commands, entry points, generated paths and known gotchas.
---

# Repository Map — client-reactjs

Read this before touching anything. It says where things are and how to run them. The
underlying facts about the product live in `wiki/` and are linked rather than repeated;
the rules live in [`../../rules/repository.md`](../../rules/repository.md).

## What this repository is

`lxtranslator_client`, the React single page application for LXTranslator. It talks to
`LXTranslator/server-expressjs` over HTTP and holds no server logic of its own. Node.js
20 or newer, ES modules, Vite, React Router, Vitest.

The shared instruction set is **not** in this repository. It resolves through the
`lxagents-agents-base` MCP connector — see the bootstrap block in
[`../../../AGENTS.md`](../../../AGENTS.md).

## Commands

```bash
npm install             # once, on a clean clone
npm run dev             # Vite dev server; proxies /api to http://localhost:4000
npm run build           # production bundle into dist/
npm run preview         # serve the built bundle
npm test                # full Vitest suite, no configuration required
npm run test:watch      # watch mode
npm run test:coverage   # with coverage
npm run audit:security  # npm audit, fails at high severity
```

`npm test` must pass on a clean clone with no configuration. The dev server expects the
backend running on port 4000; the backend itself needs no configuration.

## Where things live

| Path | What it holds |
|---|---|
| `src/main.jsx` | Entry point. Mounts React, the router and the session provider, and imports the style layers in order. |
| `src/App.jsx` | The route table — public, protected and fallback routes. |
| `src/lib/` | Framework free helpers. `apiClient.js` is the only place that talks HTTP. |
| `src/context/` | `AuthContext.jsx` — session, namespace list, active namespace. |
| `src/hooks/` | Reusable hooks, currently the debounced availability probe. |
| `src/components/` | `layout/`, `routing/`, `editor/`, `chat/`, `account/`, `ui/`. |
| `src/pages/` | One file per route, named `<Name>Page.jsx`. |
| `src/styles/` | `main.css` then `shared/`, `auth/`, `editor/`, `chat/` — imported in that order. |
| `tests/` | Vitest and Testing Library. `helpers/renderWithProviders.jsx` is the entry point for rendering. |
| `index.html` | Application shell and document head. |
| `vite.config.js` | Build, dev server proxy and test runner configuration. |
| `Dockerfile`, `nginx.conf.template` | Multi stage image; the template is rendered at container start up. |

## Generated paths — leave them alone

`dist/`, `node_modules/`, `coverage/`. None are committed.

## Entry points for a change

* **A new route** — `src/pages/<Name>Page.jsx`, registered in `src/App.jsx`. The
  procedure is in [`../../rules/repository.md`](../../rules/repository.md).
* **A new server call** — an endpoint helper in `src/lib/apiClient.js`. Never `fetch`
  from a component.
* **A visual change** — tokens first. The specification is
  [`../../../wiki/information/design-system.md`](../../../wiki/information/design-system.md).

## Gotchas

* **The footer repeats navigation links.** An unscoped `getByRole('link', ...)` in a test
  can match twice. Scope with `within(main)`.
* **Pages render their heading before data resolves.** Waiting on the heading and then
  querying a data dependent element races. Wait for the element you are asserting on.
* **Mock `src/lib/apiClient.js`, not `fetch`.** Mocking `fetch` bypasses the error shaping
  every component depends on.
* **`VITE_` variables are public.** They are inlined into the bundle at build time and
  readable by anyone. Nothing sensitive goes in one.
* **Overlays that cover content are opaque on purpose.** Modals and the mobile nav panel
  do not use `backdrop-filter`; section 3 of the design system explains why.
* **The API speaks snake_case.** JavaScript here is camelCase; the boundary is
  `src/lib/apiClient.js`.
