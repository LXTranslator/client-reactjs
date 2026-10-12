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
| Keep `.btn--sponsor` | No page renders it, but `wiki/information/design-system.md`, which describes itself as the project agnostic source of truth, lists it among the buttons. Removing it would leave that document wrong or make this copy drift, for five lines. |

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

### Task 4 — refactor/form-field

`TextField`, `TextAreaField` and `SelectField` each carried their own copy of the label,
the required marker, the hint, the error and the three accessibility attributes that tie
them to the control. The copies had already drifted: only the text input set
`aria-required`, and the select ignored `required` entirely. A private `Field` shell now
renders all of that once and hands the control the props it must carry, so the three
exported components are each a few lines.

Checked by rendering every control in its main states through both the old and the new
module and comparing the markup. Two differences, both deliberate:

* a required textarea or select now gets `aria-required` and the marker, like the text
  input already did; no current form marks one required, so nothing on screen changes;
* the flex row around the label is rendered only when there is a `trailing` element
  beside it. Without one it held a single block label, so the spacing is unchanged.

`FormField.jsx`: 234 lines, down to 179. Client suite: 301 passing across 17 files.

### Task 5 — refactor/load-state

`src/hooks/useLoader.js` takes a loader and its dependencies and returns the data, the
busy flag, the failure and a `reload`. Twelve pages and panels had written that by hand —
two `useState` calls, a `useCallback` with a `try`, `catch` and `finally`, and a
`useEffect` to start it — and four more components had their own `cancelled` flag
around a one off catalogue fetch. All of them use the hook now:

* the account panels: `SessionsPanel`, `UsagePanel`, `OAuthProviderButtons`;
* the account pages: `TwoFactorPage`, `LinkedAccountsPage`;
* the namespace pages: projects, members, settings, export formats, AI settings;
* the project pages: detail, settings, and the translation editor, whose offline
  platform notice and format catalogue are two more loaders.

Behaviour the hook fixes in one place rather than twelve:

* **Only the latest load settles.** Before, a slow response could land after a newer
  one and overwrite it, which is what happens when the namespace in the URL changes
  while the previous namespace's list is still in flight. A hook test pins this, and
  it fails when the guard is removed.
* **A failed reload keeps the last good data**, which is what every page already did
  by not touching its state on failure.
* **A quiet reload** keeps the busy state hidden, replacing the `load(true)` boolean
  the two pollers passed. It is an option object now, so a handler passed straight to
  `onClick` can never turn an event into "quiet" by accident.

Deliberately left alone: `ChatPage`, whose session list load returns the list to its
caller and resets the conversation around it, and `AuthContext`, which owns the session
itself. Neither is the same shape, and forcing them into it would cost clarity.

The translation editor no longer keeps the previous payload while the file is being
reprocessed. The page shows the pipeline's progress in that state and never rendered
the stale payload, so nothing visible changes.

Documented in `wiki/information/architecture.md` under "Loading data", and the hooks
row of the repository map.

`src/`: 479 lines removed and 282 added across 14 files, the hook itself included.
Client suite: 305 passing across 18 files.

### Task 6 — refactor/form-state

`src/hooks/useForm.js` holds a form's values, errors, submission error and busy flag,
and gives back `handleChange(field)` and `submit(validators, action)`. It applies the
three form rules from `repository.md` itself, so a page cannot forget one: an error clears
as soon as its field is edited, nothing is sent until every validator passes, and a server
rejection is mapped back onto the fields it names.

Nine forms use it: sign in, both steps of it, registration, password reset, organization
creation, namespace settings, project creation, project settings, AI credentials and
export formats. `AccountSettingsPage` and `ProjectUploadsPage` keep their own state: the
first runs several small forms through a settings token, and the second is a file
picker, and neither has the shape the hook serves.

What changed for a user, deliberately:

* **Sign in and password reset now map field errors** from a server rejection onto the
  fields, as the other forms already did. A test pins it on the reset page, and it fails
  against the previous page.
* **The export format form reports all of its problems at once.** It used to check that
  the value and hash fields differ only after every other field passed, and then show that
  one error alone. The check is part of the hash field's validator now.

Three pages share one error between the form and the actions beside it (deleting a
project, removing a key, removing a format) and show whichever happened last. They keep
that by renaming the hook's error rather than adding a second one.

`src/components/project/PlatformFields.jsx` is the platform and model picker that project
creation and project settings each wrote out in full, with the same switch handler that
resets the model to the new platform's default. Only the hint differs between the two
pages, so the hint is a prop.

Documented in `wiki/information/architecture.md` under "Validation", and in the hooks and
components rows of the repository map.

`src/`: 599 lines removed and 414 added across 11 files, the hook and the picker
included. Client suite: 309 passing across 19 files.

### Task 7 — perf/route-splitting

`src/App.jsx` imported all 24 pages up front, so the first visit to the sign in page
downloaded the translation editor, the chat workspace and the QR encoder for two factor
setup as well. The pages now load on demand: `import.meta.glob` collects the page
modules, a small `page(name)` helper wraps each in `React.lazy` (the pages keep their
named exports), and `AppLayout` holds the one `Suspense` boundary, so the header and
footer stay put while a page arrives. A misspelt page name throws when `App.jsx` loads,
not when somebody first opens that route.

Production build, before and after:

| | Before | After |
|---|---|---|
| JavaScript before any page renders | 406.54 kB, 116.62 kB gzip | 255.24 kB, 82.27 kB gzip |
| Sign in page on top of that | included | 3.13 kB, 1.29 kB gzip |
| Two factor page (holds the QR encoder) | included | 11.26 kB, 4.44 kB gzip |

The 255 kB is the entry chunk plus the two shared chunks it preloads (the API client,
and the UI and helpers every page uses). A smoke test against `vite preview` in Chromium
loaded `/login`, `/register` and `/forgot-password`, each fetching only its own page
chunk, and followed a link from sign in to the forgot password page; the only console
error was the absent API answering 502.

Documented in `wiki/information/architecture.md` under "Build". Client suite: 309
passing across 19 files.

### Task 8 — refactor/unused-css

Two rules that no component renders are gone:

* `.stack` in `src/styles/shared/components.css`, a utility nothing applies.
* `.auth__divider` and its two rules in `src/styles/auth/auth.css`. It was written with
  the provider buttons as a labelled rule between them and the credentials form, but no
  component ever rendered it; `git log -S` shows only the commit that added it. The
  comments in `auth.css` and `LoginPage.jsx` that described it now say what is there:
  the provider row, and why its spacing belongs to the component.

The plan named `.btn--sponsor` as well. It stays, for the reason in the decisions table.
`chat__message--you` looks unused to a plain search but is built from the message role at
run time, and the `--sponsor` token is used by the danger button, the strength meter and
several accents, so both stay.

Built CSS: 27.43 kB to 27.18 kB (6.00 kB to 5.96 kB gzip). Client suite: 309 passing
across 19 files.
