# 0.18.0

Released 2026-11-12. The client is written in strict TypeScript. Every file under `src/`
and `tests/` is `.ts` or `.tsx`, the compiler checks the whole tree before every build,
and every dependency is at its latest release.

Nothing here needs configuring, and no route, endpoint, visible behaviour or design
changed. The version is a minor because the source language, the build script and the
Docker build inputs change for anyone working on the client, though a visitor sees
nothing new. `src/` holds 12,477 lines of TypeScript, where it held 11,594 lines of
JavaScript; the difference is the type annotations and `src/lib/types.ts`.

## Added

- `tsconfig.json`: `ES2022`, `ESNext` modules with `bundler` resolution, `react-jsx`,
  `strict`, `noEmit`, `verbatimModuleSyntax` and `allowImportingTsExtensions`. Vite
  writes the bundle; `tsc` only checks.
- `npm run typecheck`, which runs `tsc` alone.
- `src/lib/types.ts`, naming the shapes the API sends and accepts in the server's
  snake_case. Each lists only the fields this client reads.
- `tests/helpers/mocks.ts`, whose `asMocked` gives a module replaced by `vi.mock` its
  mocked type.
- `typescript` 7.0.2, `@types/react`, `@types/react-dom` and `@types/node`, all as
  development dependencies, so none reaches the bundle.

## Changed

- **`npm run build` is `tsc && vite build`.** A type error fails the build, and with it
  the Docker image, whose build stage now copies `vite.config.ts` and `tsconfig.json`.
- `vite.config.js` is `vite.config.ts`, typed through `vitest/config` so the test block is
  checked as well. Tests, the setup file and coverage match only `.ts` and `.tsx`.
- `index.html` loads `src/main.tsx`, and the page glob in `App.tsx` matches `*Page.tsx`.
- `apiRequest<T>` is generic, and every helper on `api` states its parameters and the
  payload it resolves to. `useForm<V>`, `useLoader<T>` and `useAvailability` export their
  state types, and `AuthContextValue` types the session context.
- Imports name `.ts` and `.tsx` files, keeping the explicit extension this codebase
  already wrote.
- The suite is unchanged in substance: 309 tests across 19 files, now typed. No
  assertion changed.

## Security

Every dependency moved to its latest release, and `npm audit` reports
**0 vulnerabilities**. `npm outdated` is empty.

- `react` and `react-dom` 19.3.1, `react-router` 8.5.1, `vite` 8.3.8.
- `vitest` 5.1.0, `jsdom` 31.0.0 (a major, from 30), `@vitejs/plugin-react` 6.3.0 and
  `@testing-library/user-event` 14.6.9, all development only.

## Notes

**The compiler corrected the API shapes as soon as the pages were typed.** The first
draft of `types.ts` was written from the helpers; the pages then disagreed with it in
nine places, each where the page was right: the enrolment field is `otpauth_uri`, a
search returns `{ method, matches }`, a backfill reports `configured`, `embedded` and
`remaining`, and so on. That is the point of the change, and the reason a field added
to `types.ts` should be one a component actually reads.

**`tsc` checks and Vite only transforms.** `npm run dev` and `npm test` strip types
without checking them, so a type error shows up in `npm run typecheck` or
`npm run build`, never in the dev server.

Not installed deliberately: `tsx` and `ts-node`. Vite and Vitest already transform
TypeScript, and nothing in this repository runs a `.ts` file through Node directly. The
`main`, `types`, `bin` and `start` fields do not apply either: the package is private and
ships a static bundle served by nginx.
