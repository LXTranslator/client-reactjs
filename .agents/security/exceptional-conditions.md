---
name: Mishandling of Exceptional Conditions
description: Render failures usefully without inventing detail the server withheld.
---

# Mishandling of Exceptional Conditions

## The shape

Every failure arrives as an `ApiError` from `src/lib/apiClient.js`, carrying a
status, a stable code, a client safe message and any field level detail. Even a
network failure becomes one, with status `0` and code `NETWORK_ERROR`, so a page
never has to distinguish a transport failure from an API failure.

## Rules

1. **Render the server's message.** It was written to be read by a user. Do not
   replace it with a generic string, which throws away the one piece of
   information that would help.
2. **Do not enrich it.** The server deliberately withholds internal detail;
   guessing at a cause in the interface reintroduces exactly what it suppressed.
3. **Map field errors back onto fields.** `error.fieldErrors` maps a field name
   to a message. Putting it beside the offending input is far more useful than a
   list at the top of a form.
4. **Never render a raw exception.** `ErrorMessage` accepts an `ApiError` and
   renders its message. Nothing renders `error.stack`.
5. **A failed background probe must not block the interface.** The availability
   check and the provider catalogue both swallow their errors, because the form
   still works without them and the server validates on submit either way.
6. **Reload after a refused action** where local state may now be wrong. The
   members page reloads after a rejected role change so the select reflects
   reality.
7. **A 401 clears the session.** `AuthContext` treats it as signed out rather
   than leaving a half authenticated shell. The account settings page does the
   same with a spent confirmation token.

## Loading and empty states

Every asynchronous view has three states and all three are rendered:

* **Loading**: `LoadingState`, with `role="status"`.
* **Empty**: `EmptyState`, usually with the action that would fill it.
* **Error**: `ErrorMessage`, plus a way back.

A page that renders nothing while loading looks broken, and a page that renders
an empty list identically to a failed fetch is actively misleading.

## Processing failures

A file whose translation failed carries `status: 'FAILED'` and a client safe
`error_message` from the server. The editor renders it with two actions: retry,
and check the project's API keys, because an exhausted or revoked credential is
the most common cause.
