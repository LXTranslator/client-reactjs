# System Architecture

## Shape

A single page application. Data flows one way: pages read state from context or
fetch it through the API client, and every mutation goes back through that same
client.

```
main.jsx
  └── BrowserRouter
        └── AuthProvider          session, namespaces, landing namespace
              └── App             route table
                    └── AppLayout header, <main>, footer
                          └── page components
                                └── ui components

every network call ──> src/lib/apiClient.js ──> /api/v1
```

No component calls `fetch` directly. Routing token attachment, envelope
unwrapping and error shaping through one module is what keeps those concerns
from drifting page by page.

## The namespace in the path

A namespace occupies the first path segment. `/orgA` is the organization `orgA`,
`/jetsada` is that person's namespace, and both are that namespace's project
list.

```
/:namespace
/:namespace/settings
/:namespace/settings/members
/:namespace/project/:projectId
```

Which namespace a page acts on is therefore a property of the URL, not of the
session. Two people opening the same link see the same thing, a bookmark keeps
working, and the back button moves between namespaces the way it moves between
anything else.

`components/routing/NamespaceRoute.jsx` resolves the segment once and supplies
it to every nested route through `useNamespace()`, mirroring how the server
resolves namespace access once in middleware rather than in each handler. A
namespace absent from the accessible list renders as missing, which spares the
pages a round of requests they would be refused. That is presentation: the
server still authorises every request.

Links are built by `src/lib/paths.js` rather than assembled inline, because a
namespace now appears in nearly every URL and one wrong segment points a visitor
at somebody else's.

### Reserved first segments

`api`, `assets`, `login`, `namespaces`, `organizations`, `register` and
`settings` are matched before any namespace, so an account named after one would
never render. The server refuses to register them, and `paths.js` holds the same
list for the client's own validation. **The two lists are one list and must be
changed together.** `api` and `assets` are not application routes at all: nginx
answers them before the bundle loads, which is exactly why they are reserved.

### The landing namespace

`AuthContext` keeps one namespace related value: which namespace `/` and the
sign in redirect send a visitor to. It is remembered in session storage and
re-validated whenever the namespace list loads, falling back to the personal
namespace when the remembered one is no longer reachable. It decides where a
visitor arrives, never what a page acts on.

## Route table

| Path | Access | Page |
|---|---|---|
| `/` | any | Redirects to the dashboard or sign in. |
| `/login` | signed out | Sign in. |
| `/register` | signed out | Registration. |
| `/forgot-password` | any | Requests a reset link. |
| `/reset-password` | any | Completes a reset. |
| `/namespaces` | signed in | Every namespace the visitor can act in. |
| `/organizations/new` | signed in | Organization creation. |
| `/settings` | signed in | Account settings. |
| `/:namespace` | signed in | The namespace's project list and creation. |
| `/:namespace/settings` | signed in | Organization profile and deletion. |
| `/:namespace/settings/members` | signed in | Member management. |
| `/:namespace/project/:projectId` | signed in | File list. |
| `/:namespace/project/:projectId/uploads` | signed in | Upload. |
| `/:namespace/project/:projectId/settings` | signed in | Provider, model and API keys. |
| `/:namespace/project/:projectId/file/:fileId` | signed in | Translation editor. |
| `*` | any | Not found. |

Password recovery stays reachable in both states, because a signed in visitor may
still be completing a reset started elsewhere.

## Session handling

The token lives in `sessionStorage` and in a module level variable. Session
storage rather than local storage means it does not outlive the browser tab,
which limits the window on a shared machine.

On first mount the provider verifies any stored token by calling `/auth/me`. A
rejected token is cleared and treated as a signed out session. Until that
resolves, `isLoading` is true and the route guards render a waiting state rather
than redirecting, since redirecting first would bounce a signed in visitor to the
login page on every reload.

**Route guards are presentation, not security.** They decide what to render, not
what data is reachable. Every protected resource is authorised by the server on
every request, so bypassing a guard in the browser yields empty pages rather than
somebody else's data.

## Validation

`src/lib/validation.js` mirrors every server rule. The client copy exists to
give fast, specific feedback while somebody types; the server validates
independently because anything checked only in the browser can be bypassed.

Two rules keep the two in step:

* A message names the **single** missing requirement rather than restating the
  whole policy, so somebody fixing one problem is not made to re-read the rest.
* Every field carries a concrete placeholder example, which removes far more
  confusion than prose does.

## Availability checking

Registration and organization creation both check identifiers against the API
while the visitor types, through `useAvailability`.

A namespace identifier comes from one pool: a personal user id and an
organization id can collide with each other, so both forms check the same way.

The probe is debounced and only fires once the value is **locally valid**, which
keeps it from running on every keystroke of a half typed address. A failed probe
never blocks the form; the server decides on submit.

## Polling

Two pages poll, and both stop as soon as there is nothing to wait for.

* **Project detail** polls the file list only while a file is `PENDING` or
  `PROCESSING`.
* **Translation editor** polls the file record only while it is still being
  processed.

Uploads return immediately with a `202`, because the pipeline runs on a worker
thread after the response. Polling is how the interface learns it finished.

## Destructive actions

Three levels, matched to how much is lost.

| Action | Confirmation |
|---|---|
| Remove a member, delete a file | A single confirm. |
| Delete a project | Retype the project name. |
| Delete an organization | Two dialogs: retype the identifier, then confirm. |

Organization deletion is the most destructive operation in the product, taking
its projects, files and every translation with it. The first dialog proves the
intended target; the second catches a reflexive click on the first. The server
independently requires the identifier to be echoed and refuses anyone below
`OWNER`.

## Styling

The Silver Glass design system, described in [`DESIGN.md`](../DESIGN.md). Layers
are imported in the specified order by `main.jsx`:

```
main.css  ->  shared/layout.css  ->  shared/components.css  ->  <section>/<section>.css
```

Every colour, radius and shadow comes from a token declared on `:root`, so the
whole product can be rebranded by editing one file.

The single deliberate deviation from the specification is section 6, the runtime
partial include system. That solves a problem a static multi page site has and a
single page application does not; header and footer are React components
rendered by `AppLayout` instead. The intent, navigation defined once and every
page in step, is preserved exactly. `DESIGN.md` section 10 records the mapping.

## Accessibility

Handled once in shared components rather than repeated per page:

* Semantic landmarks from `AppLayout`, one `<h1>` per page.
* Every control has a real `<label>`; `FormField` wires `aria-invalid` and
  `aria-describedby` automatically.
* Errors carry `role="alert"`; loading states carry `role="status"`.
* The modal sets `role="dialog"` and `aria-modal`, moves focus in on open,
  restores it on close, and closes on Escape.
* Visible `:focus-visible` outline throughout.
* Reduced motion preference respected globally.

## Build

Vite. The dev server proxies `/api` so the browser sees a single origin during
development; the production image does the same through nginx. One origin means
no preflight and no need to relax the backend's origin allowlist.

`VITE_API_BASE_URL` is inlined at build time and defaults to a relative path, so
the bundle calls whatever origin served it.
