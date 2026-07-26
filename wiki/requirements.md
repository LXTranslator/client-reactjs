# Requirements

## Scope

The browser interface for LXTranslator. It consumes the API provided by
`server-expressjs` and holds no data of its own beyond the current session.

## Functional requirements

### Routing

| Id | Requirement | Status |
|---|---|---|
| FR-1 | `/` redirects an unauthenticated visitor to `/login`. | Done |
| FR-2 | `/login` offers sign in, a link to `/register` and a forgot password link. | Done |
| FR-3 | `/register` captures user id, email, password and confirmation. | Done |
| FR-4 | `/namespaces` shows the dashboard for the signed in account. | Done |
| FR-5 | `/{namespace}/settings` shows organization settings, and only for an organization. | Done |
| FR-6 | `/{namespace}/settings/members` manages organization membership. | Done |
| FR-7 | `/{namespace}` lists and creates the namespace's projects. | Done |
| FR-8 | `/{namespace}/project/{project_id}` lists the project's files. | Done |
| FR-9 | `/{namespace}/project/{project_id}/uploads` uploads a file. | Done |
| FR-10 | `/{namespace}/project/{project_id}/file/{file_id}` edits and downloads translations. | Done |
| FR-11 | `/{namespace}/project/{project_id}/settings` manages provider and model, and reports whether the account holds a key for that platform. | Done |
| FR-12 | `/settings` manages user id, email and password. | Done |
| FR-13 | `/organizations/new` creates an organization. | Done |
| FR-14 | An unknown path renders a not found page. | Done |

### Forms and validation

| Id | Requirement | Status |
|---|---|---|
| FR-15 | Every form validates on the client before submitting. | Done |
| FR-16 | Email is validated by pattern. | Done |
| FR-17 | Password strength is enforced and shown on a meter. | Done |
| FR-18 | User id format is enforced by pattern. | Done |
| FR-19 | Every field carries a concrete placeholder example. | Done |
| FR-20 | Registration checks whether the user id or email already exists before submitting. | Done |
| FR-21 | Organization creation checks the identifier and email the same way. | Done |
| FR-22 | A validation message names the single missing requirement. | Done |
| FR-23 | Server side field errors are mapped back onto their fields. | Done |

### Namespaces and organizations

| Id | Requirement | Status |
|---|---|---|
| FR-24 | The dashboard renders differently for a personal and an organization namespace. | Done |
| FR-25 | The header switches the active namespace when more than one is reachable. | Done |
| FR-26 | An organization has its own contact email, editable in settings, used for billing and account notices. | Done |
| FR-27 | Members can be invited by user id or email, have roles changed, and be removed. | Done |
| FR-28 | An organization can be deleted through a two step confirmation: retype the identifier, then confirm. | Done |
| FR-29 | Deletion is offered only to an owner. | Done |

### Projects and translation

| Id | Requirement | Status |
|---|---|---|
| FR-30 | A project selects an AI provider and model from the catalogue the API publishes. | Done |
| FR-31 | Multiple API keys can be added, reordered, disabled and removed. | Done |
| FR-32 | The key list explains and reflects the server's fallback order. | Done |
| FR-33 | Upload offers a multi select of target languages, including codes outside the shortlist. | Done |
| FR-34 | Upload shows progress and reports validation failures clearly. | Done |
| FR-35 | File status is polled until processing finishes. | Done |
| FR-36 | The editor shows the English master beside each translation. | Done |
| FR-37 | Translations and master strings can both be corrected by hand. | Done |
| FR-38 | Stale translations are flagged where the source text has changed. | Done |
| FR-39 | Locale files can be downloaded individually or all at once. | Done |

## Non functional requirements

### Security

| Id | Requirement | Status |
|---|---|---|
| NFR-1 | No secret is present in the bundle or in any build variable. | Done |
| NFR-2 | The session token is held in session storage, not local storage. | Done |
| NFR-3 | An expired or rejected token clears the session rather than leaving a broken shell. | Done |
| NFR-4 | No user content is rendered as markup; `dangerouslySetInnerHTML` is never used. | Done |
| NFR-5 | URLs entered by a user are restricted to http and https before being rendered as links. | Done |
| NFR-6 | Client side upload checks are treated as convenience, with the server as the control. | Done |
| NFR-7 | Route guards are documented as presentation, not authorization. | Done |
| NFR-8 | Credentials are sent in an Authorization header, so no cookie and no CSRF token are needed. | Done |
| NFR-9 | The served bundle carries a restrictive content security policy. | Done |
| NFR-10 | Dependencies audit clean at high severity. | Done |

### Quality and accessibility

| Id | Requirement | Status |
|---|---|---|
| NFR-11 | Semantic landmarks and one `<h1>` per page. | Done |
| NFR-12 | Every control has a real label and describes its own errors. | Done |
| NFR-13 | Errors are announced; loading states carry a status role. | Done |
| NFR-14 | The modal manages focus and closes on Escape. | Done |
| NFR-15 | Visible focus outline throughout. | Done |
| NFR-16 | Reduced motion preference respected. | Done |
| NFR-17 | Responsive down to roughly 360px, with no horizontal page scroll. | Done |
| NFR-18 | The interface follows the Silver Glass design system. | Done |
| NFR-19 | Automated tests cover validation, routing and the organization flows. | Done, 61 tests |
| NFR-20 | The suite and the build run with no configuration. | Done |
| NFR-21 | Code is separated into focused modules with a single responsibility each. | Done |
| NFR-22 | Node.js 20 or newer. | Done |

## Out of scope

* Offline support and service workers.
* Internationalising the interface itself. It manages translations; it is not
  yet translated.
* Real time collaborative editing.
* Bulk editing across files.
* Theme switching. The design system defines a single light treatment.

## Assumptions

* The API is reachable at `/api/v1` on the same origin, or at a build time base
  URL whose origin is in the server's allowlist.
* One browser tab is one session. Nothing is shared across tabs.
* The visitor's browser supports ES2022, `fetch` and CSS custom properties.
