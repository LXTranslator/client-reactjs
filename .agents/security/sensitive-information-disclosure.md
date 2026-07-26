---
name: Sensitive Information Disclosure
description: What must never be rendered, logged or persisted by the LXTranslator client.
---

# Sensitive Information Disclosure

## Never rendered

**Provider API keys.** The server returns `masked_key`, showing only the last
four characters. The client never receives a usable key, so it cannot display
one. When adding a credential the value is in a `type="password"` field, held in
component state for the duration of the form, and cleared on success.

**Password hashes.** They appear in no API response.

**Other people's email addresses.** The member list receives `toMemberJson`,
which omits the address. The organization's own contact address is shown, because
it belongs to the organization rather than to a person.

## Never logged

There is no `console.log` of request or response bodies anywhere in this
codebase, and none should be added. A browser console is readable by anyone with
access to the machine, and console output is captured by some error reporting
tools.

Specifically never log: the session token, the settings confirmation token, a
password reset token, a password, or an API key.

## Never persisted

Session storage holds exactly two values:

| Key | Value |
|---|---|
| `lxtranslator_token` | The session token, cleared on sign out. |
| `lxtranslator_active_namespace` | A namespace identifier, not sensitive. |

Nothing else is written to any browser storage. No translation content, no
account details, no cache of API responses.

## Metadata

* `<meta name="robots" content="noindex, nofollow">` keeps the application out
  of search indexes.
* `<meta name="referrer" content="no-referrer">` and the `Referrer-Policy`
  header stop URLs leaking to third parties.
* Source maps are disabled in the production build, so the original sources are
  not published alongside the bundle.

## Rules

1. **Never add a field to a display that came from an endpoint you have not
   checked.** If the server sends something it should not, report it rather than
   rendering it.
2. **Never cache API responses in storage.** Translation content is customer
   data and may be confidential.
3. **Never put a token in a URL you construct.** The reset flow receives one in
   a query string because an emailed link requires it; do not extend that
   pattern.
4. **Error messages come from the server.** Do not enrich them with internal
   detail the server deliberately withheld.
