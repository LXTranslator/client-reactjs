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
