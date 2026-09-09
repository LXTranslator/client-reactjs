---
name: memory-task-auth-security-refinement
description: Task record for the client half of adding alternative sign in, a second factor, account linking, policy pages and upload validation.
---

# Task Record — auth-security-refinement

The client half of a change that spans both LXTranslator repositories. Twelve tasks in
total; this repository owns tasks 7 to 12. `LXTranslator/server-expressjs` carries the
same record for tasks 1 to 6, which are done.

## Why

The server gained three things at 0.25.0 that no interface reaches yet:

* a TOTP second factor, which turns a correct password into a challenge rather than a
  session, so **the existing login flow breaks silently against it** — `AuthContext.login`
  would call `setAuthToken(undefined)` and carry on;
* provider sign in through github.com and gitlab.com, link only;
* a stricter uploaded filename rule, which the client's own check must mirror or a person
  is told a file is fine and then rejected.

Separately, the product has no policy pages at all.

## Decisions taken with the user

| Decision | Reason |
|---|---|
| Hyphenated public paths | A namespace owns the first path segment, so `/policy` would need reserving in `paths.js` **and** the server's `reservedIdentifiers.js` — the two are one list — and would orphan an account of that name. `/privacy-policy` and `/terms-of-service` cannot collide, because an identifier may not contain a hyphen. Account pages nest under `/settings`, which is already reserved. **No reserved segment changes in either repository.** |
| Provider initials, not avatars | `nginx.conf.template` sets `img-src 'self' data:`. A remote avatar URL is blocked by the browser, so rendering one would ship a broken image. |
| The QR encoder is written here | `connect-src 'self'` rules out a third party QR service, and `supply-chain.md` prefers a standard library equivalent to a dependency. Inline SVG sidesteps `img-src` entirely. |
| A full page redirect, never a popup | `Cross-Origin-Opener-Policy: same-origin` breaks a popup flow. |
| Buttons on the login page only | Provider sign in is link only, so offering it on the registration page would be a lie. |
| Branch convention over the harness branch | The harness mandated `claude/auth-security-refinement-txkz8q`; `branching-strategy.md` forbids a tool preset prefix and a generated suffix. The user chose the convention. |

## The tasks

| # | Title | Scope | Repository | Branch | PR |
|---|---|---|---|---|---|
| 1–6 | The server half | Second factor, provider sign in, upload containment, release 0.25.0 | server | see that repository's record | |
| 7 | Task record | This file and its index row | client | `chore/auth-security-refinement-plan` | |
| 8 | Policy pages | Two public pages and a footer column | client | `feat/policy-page` | |
| 9 | Upload validation | Close the double extension gap client side | client | `fix/upload-validation` | |
| 10 | Second factor | Challenge step at login, enrolment page, QR encoder | client | `feat/second-factor` | |
| 11 | Account linking | Provider buttons, callback page, connections page | client | `feat/account-linking` | |
| 12 | Release 0.17.0 | Version, changelog, indexes, close this record | client | `chore/release` | |

Task 7 branches from `master`; task `k` branches from task `k-1`. Branches cannot stack
across repositories, so this chain is **ordered after** the server chain rather than built
on it: each pull request here names the server pull request that must merge first.

Tasks 8 and 9 come before 10 and 11 deliberately. Neither depends on a server endpoint, so
their pull requests can merge without waiting for the server chain at all.

## Progress

### Task 7 — chore/auth-security-refinement-plan

Created this record and its row in `.agents/index/memory-index.md`, before any of the work
exists.

### Task 8 — feat/policy-page

`/privacy-policy` and `/terms-of-service`, public in both session states, beside the
password recovery routes rather than inside either guard: somebody has to be able to read
the terms before deciding to register under them.

Composed entirely from existing Silver Glass classes — `.container.narrow`, `.hero`,
`.panel`, `.deflist`, `.feature-list`, `.callout`, `details.acc`. **No new CSS.**

The content is written from what the application actually does, so every claim can be
checked against the code: the account fields are the columns on `accounts`, the session
paragraph reflects that a user agent is stored and a network address deliberately is not,
and the archived upload paragraph matches the change made in task 5. The one thing a
generated policy would have missed is the paragraph that matters most — source text
reaching a third party AI platform, which is the only place customer content leaves the
deployment. Both pages say plainly that they are not legal advice and have not been
reviewed by a lawyer, and there is a test asserting that sentence is present.

`RESERVED_SEGMENTS` is unchanged, and a test asserts it, because that is the whole reason
the addresses are hyphenated.

Also tidied while in the file: the footer's Account column used hardcoded string literals
where the Workspace column beside it used `paths.*()`. Both now use the builders, which is
what `domain.md` requires.

Client suite: 257 passing across 13 files, up from 248 across 12. `npm run build` clean.

### Task 9 — fix/upload-validation

`validateTranslationFile` in `src/lib/validation.js` now mirrors the server rule task 5
tightened: no second extension in the stem, no path separator, no leading dot, and a 128
character cap matching `UPLOAD_MAX_FILENAME_LENGTH`.

The gap it closes: `evil.php.json` and `report.html.json` satisfy a check that only looks
at the last extension, so both were accepted here and stored on the server. Harmless while
a stored name never becomes a path, but the server stopped relying on that invariant, and
a client that lags behind tells somebody their file is fine and then watches it be
rejected.

One function, four call sites, all fixed at once: `ProjectUploadsPage` twice,
`ChatConversation` and `FileGrowthPanel`.

The `What is accepted` callout on the upload page was updated in the same commit. A rule
enforced in code and described loosely in prose beside it is worse than no prose.

Restated in the docblock, because it is the thing most easily forgotten: **this is a
convenience, not a control.** Every rule exists on the server first, and `accept` on a file
input is a hint the browser may ignore.

Client suite: 262 passing, up from 257.
