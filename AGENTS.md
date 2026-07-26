# Agent Instructions — client-reactjs

Instructions for AI agents working in **this repository only**. The backend
lives in a separate repository with its own `AGENTS.md` and its own `.agents/`
directory; never read from or apply rules from that one here.

## Before you change anything

1. Read [`INDEX.md`](INDEX.md) for the repository structure.
2. Read [`README.md`](README.md) for the project context and hosting details.
3. Read [`DESIGN.md`](DESIGN.md) before touching any styling. It is the source
   of truth for the visual language, and section 10 records how it maps onto
   this React application.
4. Read [`.agents/knowledge/domain.md`](.agents/knowledge/domain.md) for the
   product concepts and routing model.
5. Read the relevant file in [`.agents/security/`](.agents/security/) before
   touching authentication, uploads, or anything that renders user content.

Keep `INDEX.md` current whenever you add, move or remove a file.

## Project shape

React single page application. Node.js 20 or newer, ES modules, Vite, React
Router.

```
src/lib/          framework free helpers: api client, validation, download
src/context/      session and namespace state
src/hooks/        reusable hooks
src/components/   layout, routing guards and ui primitives
src/pages/        one file per route
src/styles/       the Silver Glass layers, imported in order
tests/            vitest and testing library
```

## Non negotiable rules

1. **No secrets, ever.** A browser bundle is public. Every `VITE_` variable is
   readable by anyone who opens the network tab. If a value would matter if
   published, it belongs on the server.
2. **Never call `fetch` directly from a component.** Add an endpoint helper to
   `src/lib/apiClient.js` and use that, so token attachment and error shaping
   stay in one place.
3. **Never use `dangerouslySetInnerHTML`.** React escapes by default and that is
   the whole defence against cross site scripting here.
4. **Route guards are presentation, not security.** They decide what to render.
   Never rely on one to protect data; the server authorises every request.
5. **Client validation mirrors the server, it does not replace it.** When a
   server schema changes, update `src/lib/validation.js` to match so a user is
   not told something is valid and then rejected.
6. **Tokens are never used to make a decision the server should make.** Do not
   read claims out of the JWT in the browser.
7. **Styling comes from tokens.** Never hard code a hex value in a component.
8. **Content covering overlays are opaque.** Modals and the mobile nav panel do
   not use `backdrop-filter`. `DESIGN.md` section 3 explains why.

## Adding a page

```
src/pages/<Name>Page.jsx     the route component
```

Then register it in `src/App.jsx`, under `ProtectedRoute` if it needs a session.
Compose it from the existing components rather than writing new CSS; add a
per section stylesheet only when the layout is genuinely bespoke.

Every form should:

* Validate with helpers from `src/lib/validation.js`.
* Show a placeholder example on every field, from `PLACEHOLDERS`.
* Clear a field's error as soon as the user edits it.
* Map `error.fieldErrors` back onto fields after a server rejection.

## Style

- ES modules with JSX.
- JSDoc on every exported component and function: purpose, `@param`,
  `@returns`.
- Comments explain **why**, not what. Do not narrate the next line.
- Two space indent, single quotes, semicolons, trailing commas in multiline
  literals.
- camelCase in JavaScript, snake_case in API payloads, since that is what the
  server speaks.
- Avoid dashes outside file names, directory names, branch names and CSS class
  modifiers.
- Named exports for components, not default exports.

## Testing

```bash
npm test                # full suite, no configuration required
npm run test:coverage   # with coverage
npm run audit:security  # fails at high severity
```

Mock `src/lib/apiClient.js` rather than `fetch`, and render through
`tests/helpers/renderWithProviders.jsx` so the router and session provider are
present.

Two things that have already caused flaky tests here, worth avoiding:

* **Scope ambiguous queries.** The footer repeats several navigation links, so
  an unscoped `getByRole('link', ...)` can match twice. Use `within(main)`.
* **Wait for what you are asserting on.** A page renders its heading before its
  data resolves, so waiting on the heading and then querying a data dependent
  element races. Wait for the element itself.

## Git

- Branches follow `{type}/{primary-noun}`, for example `feat/login`.
  Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
  `ci`, `chore`, `revert`.
- Never work directly on `main` or `master`.
- Conventional Commits, plain text, no links and no issue identifiers.
- Commit each logical change rather than batching a session into one commit.
  Review the diff before committing.
- Bump `version` in `package.json` on every pull request, following semantic
  versioning.

## License

Proprietary, reserved for the LXTranslator organization. Do not add a dependency
whose license conflicts with it, and keep the `LICENSE` file intact.
