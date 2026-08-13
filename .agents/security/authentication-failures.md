---
name: authentication-failures
description: Session token storage and handling in the LXTranslator client.
---

# Authentication Failures

## Where the token lives

`sessionStorage`, plus a module level variable in `src/lib/apiClient.js`.

**Signing out must call `POST /auth/logout`.** Clearing the token here only
makes this browser forget it; the session stays live on the server until it
expires. Ending the current session from the session list goes through the same
sign out, never through `revokeSession`, or the browser is left holding a token
it does not know is dead.

**A created API token is shown once and held until dismissed.** Never put it in
a notice that clears itself. The server keeps a digest, so nothing can show it
again.

Session storage rather than local storage is deliberate: the token does not
outlive the browser tab, which limits the window on a shared or unattended
machine. Local storage would persist it indefinitely across restarts.

## Rules

1. **The token is attached in one place.** `apiRequest` adds the Authorization
   header. No component builds that header itself.
2. **Never decode the token in the browser to make a decision.** Its claims are
   not verified here. The account is loaded from `/auth/me`, and the server
   re-checks it on every request.
3. **A rejected token clears the session.** `AuthContext` treats a 401 during
   restore as a signed out session, rather than leaving the interface in a
   broken half authenticated state.
4. **Sign out clears everything**: the token, the account, the namespace list
   and the active namespace.
5. **Never log the token**, and never put it in a URL. A URL reaches browser
   history, referrer headers and proxy logs.
6. **Settings tokens are held in component state only.** The ten minute
   confirmation token minted by `/settings/confirm` is never stored, and it is
   discarded as soon as it is spent, because the server only accepts it once.
7. **Password recovery links carry the token in the query string** because that
   is how an emailed link works. The page reads it and does not store it.

## Password handling

* Passwords exist in component state for the duration of a form and are never
  stored.
* The strength meter is presentational. `validatePassword` decides whether a
  password is acceptable, and its message names the single missing requirement.
* `autoComplete` is set correctly per field, so password managers behave.

## When adding an authenticated call

Add an endpoint helper to `src/lib/apiClient.js`. It inherits token attachment
and the 401 handling automatically. Never bypass it with `fetch`.
