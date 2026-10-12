---
name: memory-state-repository-state
description: Current known state of client-reactjs after adopting the shared instruction set — what exists, the stack, and the next obvious step.
---

# Repository State — client-reactjs

## What this is

`lxtranslator_client`, version 0.17.1. The React single page application for
LXTranslator, consuming the API served by `LXTranslator/server-expressjs`.

## Stack

React with React Router, Vite, ES modules, Node.js 20 or newer. Vitest and Testing
Library for tests. Deployed as a multi stage Docker image serving the built bundle
through nginx, with the server configuration rendered from `nginx.conf.template` at
container start up.

## Instruction system

Mode B consumer. The shared set resolves through the `lxagents-agents-base` MCP
connector; nothing shared is copied into this repository, and the override table in
`.agents/index/root-index.md` is empty. Local content is:

* `.agents/rules/repository.md` — this repository's own rules.
* `.agents/knowledge/domain.md` — product vocabulary and the routing model.
* `.agents/security/` — ten policies written for a public browser bundle.
* `.agents/wiki/context/repository-map.md` — agent orientation.
* `.agents/index/` — six indexes routing all of the above plus both wiki trees.

Human documentation lives in `wiki/` under `information/`, `reference/`, `environments/`
and `logs/`.

## Authentication, as of 0.17.0

Three sign in paths, and one thing about the first of them worth knowing before touching
`AuthContext`:

* **A correct password no longer implies a session.** `login` returns a discriminated
  result — either an account or a second factor challenge — because an account with a
  factor is answered with a challenge and no token. Reading `access_token` off the
  response, which is what the code used to do, calls `setAuthToken(undefined)` and carries
  on as though somebody were signed in. Silently. There is a test pinning that.
* The challenge step is a **render state inside `LoginPage`**, not a route. A route would
  sit inside `PublicOnlyRoute` and be redirected away the moment the session existed, and
  it would lose `location.state.from` with it.
* Provider sign in is link only, so the buttons appear on the sign in page and not the
  registration page, and `OAuthProviderButtons` renders nothing at all when the server
  reports no configured provider.

## Shared building blocks, as of 0.17.1

Reach for these before writing the same thing again in a page:

* `useLoader(load, deps)` in `src/hooks/` for anything a page fetches on mount. It drops
  a response that a newer load has overtaken, keeps the last good data on a failed
  reload, and takes `reload({ quiet: true })` for polling. `ChatPage` and `AuthContext`
  are the two deliberate exceptions.
* `useForm(initialValues, { onEdit })` in `src/hooks/` for a form: `handleChange(field)`
  clears that field's error, and `submit(validators, action)` maps a server rejection's
  `fieldErrors` back onto the fields.
* `endpoint` and `withQuery` in `src/lib/apiClient.js` for a new API helper. The tag
  encodes every interpolated value as one path segment.
* The private `Field` shell in `src/components/ui/FormField.jsx` for a new form control.
* A new page is one route in `src/App.jsx` plus one `page('NamePage')` line, and the file
  name must match the exported component, because every page is a lazily loaded chunk.

## Three content security policy facts that shape the interface

Each one rules out an approach that would otherwise be obvious. They are in
`nginx.conf.template` and are easy to rediscover the hard way:

* `img-src 'self' data:` — **no remote image.** A provider avatar is blocked by the
  browser, so the connections page renders initials.
* `connect-src 'self'` — **no third party service.** The QR code is generated in the
  bundle by `src/lib/qrcode.js` and drawn as an inline SVG.
* `Cross-Origin-Opener-Policy: same-origin` — **no popup.** Provider sign in is a full
  page redirect.

## What is not built

* No change log history before 0.16.0 — the `wiki/logs/` tree starts at the version
  current when the instruction system was adopted.
* No CI workflow in this repository.
* No `.agents/wiki/sop/` or `.agents/wiki/domain/` pages yet; only `context/` is
  populated.
* No interface for registering with a provider. Linking is deliberate on the server side,
  so the buttons never appear on the registration page.

## Next obvious step

One client rule is waiting on the user's decision rather than being written, per the
discovery protocol: that the content security policy forbids a remote image, so no third
party avatar or badge may be rendered. It is listed at the end of
[`../tasks/auth-security-refinement.md`](../tasks/auth-security-refinement.md).

Still open from 0.16.0: the eight security topics this repository shares by filename with
`LXTranslator/server-expressjs` have different bodies in each repository because one is a
browser bundle and the other is a server. Whether any of them should be promoted to the
shared set is an open question for the user; it would be a change to `LXAgents/mcp-server`
and has not been made.
