---
name: secrets-management
description: Why no secret can exist in a browser bundle, and what to do instead.
---

# Secrets Management

## The rule

**A browser bundle is public.** Every value Vite inlines at build time is
readable by anyone who opens the network tab and reads the JavaScript. There is
no such thing as a hidden value in this repository.

A secret placed in a `VITE_` variable is not configured, it is published.

## Rules

1. **Never put a credential in a `VITE_` variable.** Not an API key, not a
   signing secret, not a database password, not a webhook token.
2. **Never hard code one in source either.** The same applies, only more
   visibly.
3. **Provider API keys belong to the server.** They are entered per account, on
   the namespace AI settings page, sent once over TLS, encrypted server side,
   and never returned. The client only ever sees `masked_key`, showing the last
   four characters. No project view enters or renders one: a project names a
   platform and a model and borrows the key from its account.
4. **The session token is not a configured secret.** It is issued per session,
   held in session storage, and cleared on sign out. See
   `authentication-failures.md`.
5. **`.env` is excluded from version control** and from the Docker build
   context.

## What legitimately belongs in a build variable

Only values that are already public:

| Variable | Why it is fine |
|---|---|
| `VITE_API_BASE_URL` | The URL the browser is about to call anyway. |
| `VITE_API_PROXY_TARGET` | Development only; never reaches a bundle. |

## If a secret is needed

It needs a server. Add an endpoint to `server-expressjs` that holds the
credential and performs the call, and have the client call that endpoint. There
is no client side workaround, and obfuscation is not one.

## Verification

```bash
npm run build
grep -rIE "sk_live|sk-ant-|-----BEGIN|password" dist/   # must find nothing
```

Run this before publishing an image if the build configuration has changed.
