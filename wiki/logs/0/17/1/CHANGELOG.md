# 0.17.1

Released 2026-10-12. A code reduction pass: data loading and form state each live in one
hook, the form controls share one shell, every page loads on demand, and two dead links
are fixed.

Nothing here needs configuring, and no route, endpoint, dependency or design changed. The
version is a patch because the links are a fix and everything else is internal. `src/`
holds 11,594 lines of JavaScript, down from 12,021, and the JavaScript a visitor
downloads before any page renders drops from 406.54 kB to 255.24 kB (116.62 kB to
82.27 kB gzip).

## Added

- `src/hooks/useLoader.js`, which runs a page's load and returns the data, the busy flag,
  the failure and a `reload`. Thirteen pages and panels used to write that by hand.
- `src/hooks/useForm.js`, which holds a form's values and errors and runs its submission:
  an error clears when its field is edited, nothing is sent until every validator passes,
  and a server rejection maps back onto the fields. Nine form pages use it.
- `src/components/project/PlatformFields.jsx`, the platform and model picker that project
  creation and project settings each wrote out in full.
- `tests/apiClient.test.js`, `tests/useLoader.test.jsx` and `tests/useForm.test.jsx`, and
  a routing test for the project back link. The suite is 309 tests across 19 files, up
  from 297 across 16.

## Changed

- **Every page is its own chunk.** `src/App.jsx` loads pages through `React.lazy`, and
  `AppLayout` shows a loading state inside `<main>` while one arrives. The sign in page no
  longer downloads the translation editor, the chat workspace or the QR encoder.
- `src/lib/apiClient.js` builds every path with one `endpoint` template tag that encodes
  each value as a single segment, and every query string with one `withQuery` helper.
  All 94 helper calls were compared against the old module and none differ, except that a
  search with a space now sends `+` rather than `%20`, which the server reads back as the
  same text.
- `TextField`, `TextAreaField` and `SelectField` render through one private `Field` shell.
  A required textarea or select now carries `aria-required` and the required marker, as
  the text input already did.
- **Only the latest load settles.** A slow response that a newer one has overtaken, such
  as the previous namespace's list arriving after the URL changed, is dropped instead of
  overwriting the newer data.
- **Sign in and password reset show a server rejection on the field it names**, as every
  other form already did.
- **The export format form reports all of its problems at once.** It used to check that
  the value and hash fields differ only after every other field passed.
- Twelve links and redirects written as string literals use the `paths.*()` builders.

## Removed

- The `.stack` utility and the `.auth__divider` rules, which no component rendered.

## Fixed

- The "Back to projects" link on a project that fails to load, on the project page and its
  settings page, pointed at `/namespaces/projects`, which no route matches. It now leads to
  the namespace's project list.

## Notes

`.btn--sponsor` is unused too but stays, because `wiki/information/design-system.md`
lists it among the buttons and that document is shared across sites.

`ChatPage` and `AuthContext` load their data by hand on purpose: the first resets the
conversation around its session list, and the second owns the session itself. Neither has
the shape `useLoader` serves. `AccountSettingsPage` and `ProjectUploadsPage` keep their
own form state for the same reason.
