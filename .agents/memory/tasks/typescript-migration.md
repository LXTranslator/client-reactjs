---
name: memory-task-typescript-migration
description: Task record for moving the client from JavaScript to strict TypeScript — dependencies, compiler configuration, the source and test conversion, and the release.
---

# Task Record — typescript-migration

## Why

The client is 11,594 lines of JavaScript whose shapes are described only in JSDoc. Nothing
checks that a page passes a component the props it expects, that a hook returns what its
callers read, or that an API helper is called with the arguments it encodes. The owner
asked for every Node.js repository in the project to move to TypeScript, with every
dependency at its latest version and a clean audit.

## Goal, objective, detail

* **Goal** — a client whose types are checked by the compiler rather than described in
  comments.
* **Objective** — every file under `src/` and `tests/` is `.ts` or `.tsx`, `tsc` passes
  under `strict` with no `any` left implicit, `npm run build` type checks before it
  bundles, `npm test` passes the same tests as before, and `npm audit` reports nothing.
* **Detail** — this repository only. No route, API call, visible behaviour or design
  change. The server half runs in its own thread and its own repository.

Baseline on `master`: 309 tests passing across 19 files; 11,594 lines of JavaScript in
`src/`.

## Adapting the owner's checklist to a browser bundle

The checklist was written for Node services. Where it does not fit a Vite single page
application:

| Checklist item | Here |
|---|---|
| `target ES2022`, `module NodeNext` | `module ESNext` with `moduleResolution bundler` and `jsx react-jsx`, because Vite resolves the imports, not Node. `target ES2022` matches `build.target`. |
| `outDir ./dist`, `rootDir ./src` | `noEmit`. Vite writes `dist/`; `tsc` only checks. Emitting would put a second, unbundled copy where the bundle goes. |
| `tsx` or `ts-node` | Not installed. Vite and Vitest already transform TypeScript, so nothing runs a `.ts` file through Node directly. |
| `main`, `types`, `bin`, `start` | Not applicable. The package is private and ships a static bundle served by nginx. |
| `build: tsc` | `build` runs `tsc` and then `vite build`, so a type error fails the build and the Docker image. |
| `test` script | Unchanged. Vitest runs `.ts` and `.tsx` tests as they are. |

## Decisions taken with the user

| Decision | Reason |
|---|---|
| Branch convention over the harness branch | The harness named `claude/project-thread-wgirs3`; `branching-strategy` forbids a tool preset prefix and a generated suffix. |
| Work autonomously, choosing the recommended option | The owner is away and asked that each question be posed with a recommendation and then answered with it. The plan and the version were settled that way. |
| Version 0.18.0 | The source language, the build script and the Docker build inputs change for anyone working on the client, though a user sees nothing new. |

## The tasks

| # | Title | Scope | Branch | PR |
|---|---|---|---|---|
| 1 | Task record | This file and its index row | `plan/typescript-migration` | |
| 2 | Dependencies | Every dependency to latest, the compiler and type packages, audit | `build/dependencies` | |
| 3 | Compiler configuration | `tsconfig.json`, `vite.config.ts`, the type check script, the Dockerfile | `build/typescript` | |
| 4 | Library, hooks and context | `src/lib`, `src/hooks`, `src/context` to typed `.ts` and `.tsx` | `refactor/typescript-lib` | |
| 5 | Components and pages | `src/components`, `src/pages`, `App` and `main` | `refactor/typescript-ui` | |
| 6 | Tests | `tests/` to `.ts` and `.tsx`, `allowJs` off | `test/typescript` | |
| 7 | Release 0.18.0 | Version, change log, logs index, close this record | `release/0.18.0` | |

Task 1 branches from `master`; task `k` branches from task `k-1`.

## Progress

### Task 1 — plan/typescript-migration

Created this record and its row in `.agents/index/memory-index.md`, before any of the work
exists.

`.gitignore` still does not exclude `.agents/plans/`, as the code reduction record already
reported. The working plan was kept out of history through `.git/info/exclude` on the
working clone only.
