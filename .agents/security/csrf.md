---
name: Cross Site Request Forgery
description: Why bearer tokens avoid CSRF here, and exactly what would reintroduce it.
---

# Cross Site Request Forgery

## Why there is no CSRF token

CSRF depends on **ambient authority**: the browser attaching credentials to a
cross site request automatically. That is what cookies do. A form on
`attacker.example` can POST to this application, and the browser would attach the
cookie without the attacker ever reading it.

This application issues **no cookie**. The session token is held in session
storage and attached explicitly as an `Authorization` header by
`src/lib/apiClient.js`. A cross site page cannot read that storage, and cannot
make the browser attach the header on its behalf. There is no ambient authority
to abuse, so there is nothing for a CSRF token to protect.

The server confirms this from its side: `cors` is configured with
`credentials: false` and an explicit origin allowlist.

## What would reintroduce the risk

**Any move to cookie based sessions.** If a future change sets a session cookie,
CSRF protection becomes mandatory in the same commit:

1. `SameSite=Lax` at minimum, `Strict` where the flow allows it.
2. `Secure` and `HttpOnly`.
3. Anti CSRF tokens on every state changing request: POST, PATCH, PUT, DELETE.
4. The server's `cors` configuration reviewed, since `credentials: true` plus a
   permissive origin is the classic mistake.

Do not make that change casually. The current design avoids an entire
vulnerability class.

## Rules

1. **Never store the session token in a cookie**, and never send credentials
   with `fetch` (`credentials: 'include'`).
2. **Keep state changing operations on non GET methods.** A GET that mutates is
   reachable from an image tag.
3. **If a cookie is ever introduced, update this file first**, then implement
   the protections above.
