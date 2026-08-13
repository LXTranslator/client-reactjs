---
name: repository-rules
description: Rules specific to the LXTranslator client — layer boundaries, the non negotiables, how to add a page, coding style and the test approach.
---

# Repository Rules — client-reactjs

Rules that are true for **this repository only**. Everything universal — branching,
commits, pull requests, task workflow — comes from the shared set and is never restated
here.

## Mode and resolution

This repository is a **Mode B consumer**. The shared instruction set is served by the
`lxagents-agents-base` MCP connector and resolved at session start per the bootstrap
block in [`../../AGENTS.md`](../../AGENTS.md). Nothing from that set is copied into this
repository; the only local file that may carry a shared `name` is a declared override,
and every override is registered in [`../index/root-index.md`](../index/root-index.md).

## Project shape

React single page application. Node.js 20 or newer, ES modules, Vite, React Router.

```
src/lib/          framework free helpers: api client, validation, download
src/context/      session and namespace state
src/hooks/        reusable hooks
src/components/   layout, routing guards and ui primitives
src/pages/        one file per route
src/styles/       the Silver Glass layers, imported in order
tests/            vitest and testing library
```

`src/lib/` stays free of React. A page composes components; a component does not import
a page.

## Non negotiable rules

1. **No secrets, ever.** A browser bundle is public. Every `VITE_` variable is readable
   by anyone who opens the network tab. If a value would matter if published, it belongs
   on the server. See [`../security/secrets-management.md`](../security/secrets-management.md).
2. **Never call `fetch` directly from a component.** Add an endpoint helper to
   `src/lib/apiClient.js` and use that, so token attachment and error shaping stay in one
   place.
3. **Never use `dangerouslySetInnerHTML`.** React escapes by default and that is the
   whole defence against cross site scripting here. See
   [`../security/xss.md`](../security/xss.md).
4. **Route guards are presentation, not security.** They decide what to render. Never
   rely on one to protect data; the server authorises every request. See
   [`../security/broken-access-control.md`](../security/broken-access-control.md).
5. **Client validation mirrors the server, it does not replace it.** When a server schema
   changes, update `src/lib/validation.js` to match so a user is not told something is
   valid and then rejected.
6. **Tokens are never used to make a decision the server should make.** Do not read
   claims out of the JWT in the browser. See
   [`../security/authentication-failures.md`](../security/authentication-failures.md).
7. **Styling comes from tokens.** Never hard code a hex value in a component.
8. **Content covering overlays are opaque.** Modals and the mobile nav panel do not use
   `backdrop-filter`. Section 3 of
   [`../../wiki/information/design-system.md`](../../wiki/information/design-system.md)
   explains why.

## Adding a page

```
src/pages/<Name>Page.jsx     the route component
```

Then register it in `src/App.jsx`, under `ProtectedRoute` if it needs a session. Compose
it from the existing components rather than writing new CSS; add a per section stylesheet
only when the layout is genuinely bespoke.

Every form should:

* Validate with helpers from `src/lib/validation.js`.
* Show a placeholder example on every field, from `PLACEHOLDERS`.
* Clear a field's error as soon as the user edits it.
* Map `error.fieldErrors` back onto fields after a server rejection.

## Style

* ES modules with JSX.
* JSDoc on every exported component and function: purpose, `@param`, `@returns`.
* Comments explain **why**, not what. Do not narrate the next line.
* Two space indent, single quotes, semicolons, trailing commas in multiline literals.
* camelCase in JavaScript, snake_case in API payloads, since that is what the server
  speaks.
* Avoid dashes outside file names, directory names, branch names and CSS class modifiers.
* Named exports for components, not default exports.

## Testing

```bash
npm test                # full suite, no configuration required
npm run test:coverage   # with coverage
npm run audit:security  # fails at high severity
```

Mock `src/lib/apiClient.js` rather than `fetch`, and render through
`tests/helpers/renderWithProviders.jsx` so the router and session provider are present.

Two things that have already caused flaky tests here, worth avoiding:

* **Scope ambiguous queries.** The footer repeats several navigation links, so an
  unscoped `getByRole('link', ...)` can match twice. Use `within(main)`.
* **Wait for what you are asserting on.** A page renders its heading before its data
  resolves, so waiting on the heading and then querying a data dependent element races.
  Wait for the element itself.

## License

Proprietary, reserved for the LXTranslator organization. Do not add a dependency whose
license conflicts with it, and keep the `LICENSE` file intact. Dependency policy is in
[`../security/supply-chain.md`](../security/supply-chain.md).
