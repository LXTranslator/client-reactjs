---
name: broken-access-control
description: Why client side guards are presentation and never authorization.
---

# Broken Access Control

## The one thing to understand

**Nothing in this repository enforces access control.** Route guards, disabled
buttons and conditional rendering all decide *what to draw*. They do not decide
*what data is reachable*.

Anyone can edit the bundle, call the API directly, or change React state in a
debugger. If a client side check were the only barrier, it would be no barrier.

Every protected resource is authorised by the server on every request, resolved
through the namespace that owns it. Bypassing a guard here yields empty pages
and 404 responses, not somebody else's data.

## What the client checks, and why

| Check | Purpose |
|---|---|
| `ProtectedRoute` | Avoids rendering a page that would only produce 401s. |
| `PublicOnlyRoute` | Keeps a signed in visitor off the sign in page. |
| Role checks on buttons | Avoids offering an action that would be refused. |
| Organization only pages | Explains why a personal namespace has no members. |

All four are usability, not security. Removing every one of them would not
expose any data.

## Rules

1. **Never treat a client check as sufficient.** If a new action needs a
   permission, the server must enforce it. Add the check here as well, for a
   better interface, but the server is what matters.
2. **Never hide data by not rendering it.** If a value must not reach a user,
   the server must not send it. Conditional rendering leaves the value in the
   network response.
3. **Handle a 403 or 404 gracefully.** The server is the authority and may
   refuse something the interface offered, for example when a role changed in
   another tab. Show the message rather than a blank page.
4. **Reload after a refused action** where the interface state may be stale. The
   members page reloads after a rejected role change so the select snaps back to
   the role the server actually holds.

## The active namespace

The active namespace decides which namespace pages act on. It is re-validated
whenever the namespace list loads, and falls back to the personal namespace when
the remembered one is no longer reachable.

That is not an access control either. It stops the interface from pointing at
something that will only return 404 after someone is removed from an
organization.
