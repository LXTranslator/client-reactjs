---
name: memory-task-code-reduction
description: Task record for reducing and reorganizing the client code — shared hooks and primitives, route splitting, two broken links, and unused styles.
---

# Task Record — code-reduction

## Why

The client grew one page at a time, and each page brought its own copy of the same
machinery: a loading flag, an error, a reload callback and an effect to start it; a form's
values, errors, change handler and submit wrapper; a provider and model picker; a label,
hint and error wrapper around every control; an `encodeURIComponent` around every path
segment. A rule that lives in twelve copies drifts, and some already have. Two pages still
link to `/namespaces/projects`, a route that no longer exists, and four of the eleven forms
that hold field errors never map a server rejection back onto their fields, which
`repository.md` asks every form to do.

The whole application also ships as one chunk, so the sign in page downloads the
translation editor, the chat workspace and the QR encoder before it can render.

## Goal, objective, detail

* **Goal** — a smaller, faster client in which each shared concern lives in one place.
* **Objective** — fewer lines in `src/`, a smaller initial chunk, the suite still green and
  `npm run build` clean.
* **Detail** — this repository only. No API, route, dependency or design change, and no
  visible behaviour change except the two links this record names.

Baseline on `master`: 297 tests passing across 16 files, 12,021 lines of JavaScript and
2,186 lines of CSS in `src/`, and one JavaScript chunk of 406.54 kB, 116.62 kB gzip.

## Decisions taken with the user

| Decision | Reason |
|---|---|
| Branch convention over the harness branch | The harness named `claude/project-thread-mut6ku`; `branching-strategy.md` forbids a tool preset prefix and a generated suffix, and the user asked for the convention. |
| Work autonomously, choosing the recommended option | The user is away and asked that each question be posed with a recommendation and then answered with it. The plan, the version and opening the pull requests were settled that way; merging is left to the user. |
| Version 0.17.1 | Nothing new is offered to a user. The links are a fix and the rest is internal, so the release is a patch. |

## The tasks

| # | Title | Scope | Branch | PR |
|---|---|---|---|---|
| 1 | Task record | This file and its index row | `chore/code-reduction-plan` | |
| 2 | Project links | The two dead back links, and inline paths moved onto `paths.*()` | `fix/project-link` | |
| 3 | API client paths | One encoding path builder and one query helper in `apiClient.js` | `refactor/api-client` | |
| 4 | Form field shell | One label, hint and error wrapper shared by the three controls | `refactor/form-field` | |
| 5 | Load state | A `useLoader` hook in place of the hand written load blocks | `refactor/load-state` | |
| 6 | Form state | A `useForm` hook in place of the hand written form blocks, and one provider picker | `refactor/form-state` | |
| 7 | Route splitting | Pages loaded on demand behind `Suspense` | `perf/route-splitting` | |
| 8 | Unused styles | Rules no component renders | `refactor/unused-css` | |
| 9 | Release 0.17.1 | Version, change log, logs index, close this record | `release/0.17.1` | |

Task 1 branches from `master`; task `k` branches from task `k-1`. The fix comes first so
it can merge on its own without waiting for any of the refactors.

## Progress

### Task 1 — chore/code-reduction-plan

Created this record and its row in `.agents/index/memory-index.md`, before any of the work
exists.

Found while planning and reported rather than changed: `.gitignore` does not exclude
`.agents/plans/`, which `plan-creator.md` expects. The working plan was kept out of
history through `.git/info/exclude` on the working clone only.

### Task 2 — fix/project-link

The "Back to projects" link on a project that fails to load, on both the project page and
the project settings page, pointed at `/namespaces/projects`. No route matches that path,
so the way out of an error led to the not found page. Both now use
`paths.namespace(ns)`, and a routing test pins the address the link resolves to. The test
fails against the old link.

Twelve other links and redirects were written as string literals where `domain.md` asks
for the `paths.*()` builders, in the header, the route guard, and the sign in, register,
recovery and settings pages. None was broken, but each was one rename away from it. All of
them now use the builders. The route table in `App.jsx` still declares its patterns as
literals, because those are the definitions the builders mirror.

Client suite: 298 passing across 16 files, up from 297.

### Task 3 — refactor/api-client

Every endpoint helper wrapped each path segment in `encodeURIComponent` by hand, 55 times
in all, and four helpers assembled their own query strings, each in a slightly different
way. Now:

* `endpoint` is a template tag that encodes every interpolated value as one segment, so a
  helper cannot forget to and a value holding a slash cannot reach another route;
* `withQuery` appends the parameters that carry a value and leaves the rest out;
* `exportFormatParam` keeps the one special case, dropping `default` so a download URL
  stays the one this client produced before formats existed.

The two comment blocks both headed "Downloads" are one block again.

Checked rather than assumed: a script called all 94 helper and argument combinations
against the old and the new module and compared every URL, method and body. None differ.
The one change on the wire is that a search query with a space is now sent as `+` instead
of `%20`, which both URL decoders and Express read back as the same text. That was already
the case for the availability probe.

`tests/apiClient.test.js` pins three URLs against the real client: an encoded segment, an
omitted filter, and the default export format. They pass on the old module too, which is
the point; they hold the behaviour still while the code underneath changed.

`apiClient.js`: 517 lines, down to 494, with one `encodeURIComponent` left where there were
55. Client suite: 301 passing across 17 files.
