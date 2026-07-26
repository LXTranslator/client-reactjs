---
name: Software Supply Chain
description: Dependency policy for a browser bundle, where every dependency ships to the user.
---

# Software Supply Chain

## Why this matters more in a browser bundle

A compromised server dependency runs on your infrastructure. A compromised
**client** dependency runs in every user's browser, with access to the session
token, everything typed into a form, and everything rendered on screen. The blast
radius is every user, not one machine.

That is the reason the dependency list here is deliberately tiny.

## Current state

```bash
npm audit          # found 0 vulnerabilities
npm outdated       # empty
```

Three runtime dependencies, and nothing else: `react`, `react-dom`,
`react-router`.

Everything else is a development dependency and never reaches the bundle: vite,
vitest, jsdom and testing library.

### A resolved advisory worth remembering

`react-router-dom` 7.x carried an advisory affecting React Server Components
mode. This application is a client rendered single page application and does not
use that mode, so it was not exploitable here, but the audit still flagged it.

Rather than pin an older version, the dependency was moved to `react-router` 8,
which is outside the affected range and is where the DOM exports live since
version 7. The result is both current and clean, with no `react-router-dom`
compatibility shim in the tree.

The lesson: prefer resolving an advisory by moving forward. Pinning backwards
trades one risk for a stale tree.

## Rules

1. **`package-lock.json` is committed and installs use it.** The Docker build
   runs `npm ci`, which installs exactly what the lockfile pins.
2. **Install scripts are disabled in the image build** with `--ignore-scripts`,
   so a compromised package cannot execute code during the build.
3. **Audit before merging a dependency change.** `npm run audit:security` fails
   at high severity.
4. **Weigh every addition against the bundle.** Ask whether the standard library
   or an existing dependency already does it. No date library, no form library
   and no HTTP client were needed here.
5. **Never add a script tag pointing at a CDN.** The design system forbids
   external requests, and a CDN is a third party with script execution rights on
   your origin.
6. **Prefer a dependency with few dependencies of its own.** Transitive packages
   are the ones nobody reviews.

## When adding a dependency

- Check download volume, release recency and open advisory count.
- Check what it pulls in transitively, not just the package itself.
- Check the bundle size impact; `npm run build` prints it.
- Run `npm audit` and update this file if the picture changes.

## Recommended additions

Generate a software bill of materials in CI
(`npm sbom --sbom-format cyclonedx`) and archive it with each release, so a
future advisory can be traced to the exact deployed bundle.
