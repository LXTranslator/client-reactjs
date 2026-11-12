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
20 or newer, strict TypeScript, ES modules, Vite, React Router, Vitest.

The shared instruction set is **not** in this repository. It resolves through the
`lxagents-agents-base` MCP connector — see the bootstrap block in
[`../../../AGENTS.md`](../../../AGENTS.md).

## Commands

```bash
npm install             # once, on a clean clone
npm run dev             # Vite dev server; proxies /api to http://localhost:4000
npm run build           # type check, then the production bundle into dist/
npm run typecheck       # type check only, with tsc
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
| `src/main.tsx` | Entry point. Mounts React, the router and the session provider, and imports the style layers in order. |
| `src/App.tsx` | The route table — public, protected and fallback routes. |
| `src/lib/` | Framework free helpers. `apiClient.ts` is the only place that talks HTTP; `types.ts` holds the shapes the API sends and accepts. |
| `src/context/` | `AuthContext.tsx` — session, namespace list, active namespace. |
| `src/hooks/` | Reusable hooks: `useLoader` for every server read, `useForm` for every form, and the debounced availability probe. |
| `src/components/` | `layout/`, `routing/`, `editor/`, `chat/`, `account/`, `project/`, `ui/`. |
| `src/pages/` | One file per route, named `<Name>Page.tsx`. |
| `src/styles/` | `main.css` then `shared/`, `auth/`, `editor/`, `chat/` — imported in that order. |
| `tests/` | Vitest and Testing Library. `helpers/renderWithProviders.tsx` is the entry point for rendering. |
| `index.html` | Application shell and document head. |
| `vite.config.ts` | Build, dev server proxy and test runner configuration. |
| `tsconfig.json` | Compiler options. `tsc` only checks; Vite does the emitting. |
| `Dockerfile`, `nginx.conf.template` | Multi stage image; the template is rendered at container start up. |

## Generated paths — leave them alone

`dist/`, `node_modules/`, `coverage/`. None are committed.

## Entry points for a change

* **A new route** — `src/pages/<Name>Page.tsx`, registered in `src/App.tsx`. The
  procedure is in [`../../rules/repository.md`](../../rules/repository.md).
* **A new server call** — an endpoint helper in `src/lib/apiClient.ts`. Never `fetch`
  from a component.
* **A visual change** — tokens first. The specification is
  [`../../../wiki/information/design-system.md`](../../../wiki/information/design-system.md).

## Gotchas

* **The footer repeats navigation links.** An unscoped `getByRole('link', ...)` in a test
  can match twice. Scope with `within(main)`.
* **Pages render their heading before data resolves.** Waiting on the heading and then
  querying a data dependent element races. Wait for the element you are asserting on.
* **Mock `src/lib/apiClient.ts`, not `fetch`.** Mocking `fetch` bypasses the error shaping
  every component depends on.
* **`VITE_` variables are public.** They are inlined into the bundle at build time and
  readable by anyone. Nothing sensitive goes in one.
* **Overlays that cover content are opaque on purpose.** Modals and the mobile nav panel
  do not use `backdrop-filter`; section 3 of the design system explains why.
* **The API speaks snake_case.** The client's code is camelCase; the boundary is
  `src/lib/apiClient.ts`, and the payload shapes keep the server's names in
  `src/lib/types.ts`.
* **`tsc` checks, Vite emits.** `tsconfig.json` sets `noEmit`, so a type error fails
  `npm run build` and `npm run typecheck` but never `npm run dev` or `npm test`, which
  transform without checking.
