# Repository Index

This file is the entry point for understanding the project structure. Agents MUST read it first, and keep it updated whenever the structure or indexed content of this repository changes. It reflects only the files and directories that exist in this repository.

## Root Files

| Directory / File | Purpose |
|---|---|
| [`./`](./) | Repository root directory. |
| [`INDEX.md`](INDEX.md) | This project structure index. |
| [`README.md`](README.md) | Human facing project overview. |
| [`DESIGN.md`](DESIGN.md) | Silver Glass design system specification and its application here. |
| [`AGENTS.md`](AGENTS.md) | Agent instructions for this repository. |
| [`LICENSE`](LICENSE) | Proprietary license reserved for the LXTranslator organization. |
| [`package.json`](package.json) | Dependency, script and version configuration. |
| [`package-lock.json`](package-lock.json) | Pinned dependency tree for reproducible installs. |
| [`vite.config.js`](vite.config.js) | Build, dev server proxy and test runner configuration. |
| [`index.html`](index.html) | Application shell and document head. |
| [`Dockerfile`](Dockerfile) | Multi stage image building the bundle and serving it. |
| [`nginx.conf.template`](nginx.conf.template) | Static server configuration with security headers, rendered at container start up. |
| [`.dockerignore`](.dockerignore) | Paths excluded from the Docker build context. |
| [`.gitignore`](.gitignore) | Git ignore configuration. |
| [`.gitattributes`](.gitattributes) | Git attributes configuration. |

## Source Modules / Architecture

A single page application. `main.jsx` mounts the router and session provider;
`App.jsx` holds the route table. Routes render pages, pages compose components,
and everything that talks to the server goes through one API client. No
component calls `fetch` directly, so token handling and error shaping cannot
drift between pages.

### Entry Point

| Directory / File | Purpose |
|---|---|
| [`src/`](src/) | Root source directory. |
| [`src/main.jsx`](src/main.jsx) | Mounts React, the router and the session provider, and imports the style layers in order. |
| [`src/App.jsx`](src/App.jsx) | Route table for public, protected and fallback routes. |

### Libraries

Framework free helpers usable from anywhere in the tree.

| Directory / File | Purpose |
|---|---|
| [`src/lib/`](src/lib/) | Shared helpers. |
| [`src/lib/apiClient.js`](src/lib/apiClient.js) | HTTP client, token storage, typed errors and every endpoint helper. |
| [`src/lib/validation.js`](src/lib/validation.js) | Field validators, password scoring and placeholder examples. |
| [`src/lib/download.js`](src/lib/download.js) | Hands a fetched blob to the browser as a download. |
| [`src/lib/paths.js`](src/lib/paths.js) | Client route builders and the reserved first segments. |
| [`src/lib/locales.js`](src/lib/locales.js) | The 143 locale catalogue, A to Z indexing, search and locale code validation. |

### State

| Directory / File | Purpose |
|---|---|
| [`src/context/`](src/context/) | React context providers. |
| [`src/context/AuthContext.jsx`](src/context/AuthContext.jsx) | Session, namespace list and active namespace state. |
| [`src/hooks/`](src/hooks/) | Reusable hooks. |
| [`src/hooks/useAvailability.js`](src/hooks/useAvailability.js) | Debounced identifier availability probe. |

### Components

| Directory / File | Purpose |
|---|---|
| [`src/components/`](src/components/) | Reusable components. |
| [`src/components/layout/AppLayout.jsx`](src/components/layout/AppLayout.jsx) | Page chrome and the breadcrumb component. |
| [`src/components/layout/SiteHeader.jsx`](src/components/layout/SiteHeader.jsx) | Sticky glass header, navigation and namespace switcher. |
| [`src/components/layout/SiteFooter.jsx`](src/components/layout/SiteFooter.jsx) | Footer with brand and link columns. |
| [`src/components/routing/ProtectedRoute.jsx`](src/components/routing/ProtectedRoute.jsx) | Guards for signed in and signed out routes. |
| [`src/components/routing/NamespaceRoute.jsx`](src/components/routing/NamespaceRoute.jsx) | Resolves the namespace in the path once for every route beneath it. |
| [`src/components/editor/FileGrowthPanel.jsx`](src/components/editor/FileGrowthPanel.jsx) | Adds languages and merges new keys into an existing file. |
| [`src/components/editor/ConsistencyPanel.jsx`](src/components/editor/ConsistencyPanel.jsx) | On demand placeholder and coverage check against the master. |
| [`src/components/chat/ChatSessionList.jsx`](src/components/chat/ChatSessionList.jsx) | Conversations pane: the server's list, renaming, deleting and search. |
| [`src/components/chat/ChatConversation.jsx`](src/components/chat/ChatConversation.jsx) | Conversation pane and the composer, including attachments chosen or dropped. |
| [`src/components/chat/ChatContextPane.jsx`](src/components/chat/ChatContextPane.jsx) | What the assistant did, what it cost, and embedding backfill. |
| [`src/components/ui/FormField.jsx`](src/components/ui/FormField.jsx) | Accessible text, textarea, select and password fields. |
| [`src/components/ui/Feedback.jsx`](src/components/ui/Feedback.jsx) | Callouts, loading, empty, error and status displays. |
| [`src/components/ui/Modal.jsx`](src/components/ui/Modal.jsx) | Accessible modal dialog with focus management. |
| [`src/components/ui/AvailabilityHint.jsx`](src/components/ui/AvailabilityHint.jsx) | Inline identifier availability indicator. |
| [`src/components/ui/LocalePicker.jsx`](src/components/ui/LocalePicker.jsx) | Language picker with an A to Z index and search over the catalogue. |

### Pages

One file per route.

| Directory / File | Purpose |
|---|---|
| [`src/pages/`](src/pages/) | Route components. |
| [`src/pages/HomePage.jsx`](src/pages/HomePage.jsx) | Root redirect based on session state. |
| [`src/pages/LoginPage.jsx`](src/pages/LoginPage.jsx) | Sign in with user id or email. |
| [`src/pages/RegisterPage.jsx`](src/pages/RegisterPage.jsx) | Registration with live availability checking. |
| [`src/pages/ForgotPasswordPage.jsx`](src/pages/ForgotPasswordPage.jsx) | Requests a ten minute reset link. |
| [`src/pages/ResetPasswordPage.jsx`](src/pages/ResetPasswordPage.jsx) | Completes a reset using a single use token. |
| [`src/pages/NamespacesPage.jsx`](src/pages/NamespacesPage.jsx) | Lists every reachable namespace, each linking to its own path. |
| [`src/pages/OrganizationCreatePage.jsx`](src/pages/OrganizationCreatePage.jsx) | Creates an organization, checking identifier and email availability. |
| [`src/pages/NamespaceSettingsPage.jsx`](src/pages/NamespaceSettingsPage.jsx) | Organization profile, contact email and two step deletion. |
| [`src/pages/NamespaceMembersPage.jsx`](src/pages/NamespaceMembersPage.jsx) | Member invitation, role changes and removal. |
| [`src/pages/NamespaceExportFormatsPage.jsx`](src/pages/NamespaceExportFormatsPage.jsx) | Export format catalogue and creation, with a live leaf preview. |
| [`src/pages/NamespaceAiSettingsPage.jsx`](src/pages/NamespaceAiSettingsPage.jsx) | Namespace AI credential chain, with chat and embedding model choices. |
| [`src/pages/ChatPage.jsx`](src/pages/ChatPage.jsx) | The assistant, in three panes. |
| [`src/pages/ProjectsPage.jsx`](src/pages/ProjectsPage.jsx) | A namespace's project list and creation, at `/:namespace`. |
| [`src/pages/ProjectDetailPage.jsx`](src/pages/ProjectDetailPage.jsx) | File list with processing status polling. |
| [`src/pages/ProjectUploadsPage.jsx`](src/pages/ProjectUploadsPage.jsx) | File upload with multi select target languages. |
| [`src/pages/ProjectSettingsPage.jsx`](src/pages/ProjectSettingsPage.jsx) | Platform and model. A project holds no credentials; the page links to the account chain that pays for it. |
| [`src/pages/TranslationEditorPage.jsx`](src/pages/TranslationEditorPage.jsx) | Translation editor and locale download. |
| [`src/components/account/SessionsPanel.jsx`](src/components/account/SessionsPanel.jsx) | Where the account is signed in, and the tokens machines use. |
| [`src/pages/AccountSettingsPage.jsx`](src/pages/AccountSettingsPage.jsx) | User id, email and password changes behind a confirmation token. |
| [`src/pages/NotFoundPage.jsx`](src/pages/NotFoundPage.jsx) | Fallback for an unmatched route. |

### Styles

Layered exactly as the design system specifies, imported in order by `main.jsx`.

| Directory / File | Purpose |
|---|---|
| [`src/styles/`](src/styles/) | Stylesheet root. |
| [`src/styles/main.css`](src/styles/main.css) | Root tokens, base element styles and the silver backdrop. |
| [`src/styles/shared/layout.css`](src/styles/shared/layout.css) | Header, navigation, footer, breadcrumbs and the responsive collapse. |
| [`src/styles/shared/components.css`](src/styles/shared/components.css) | Panels, cards, tables, badges, buttons, callouts, forms and modals. |
| [`src/styles/auth/auth.css`](src/styles/auth/auth.css) | Authentication page layout. |
| [`src/styles/editor/editor.css`](src/styles/editor/editor.css) | Translation editor, upload dropzone, key priority list and export formats. |
| [`src/styles/chat/chat.css`](src/styles/chat/chat.css) | The three pane assistant layout and its collapse. |

## Tests

| Directory / File | Purpose |
|---|---|
| [`tests/`](tests/) | Automated test suite. |
| [`tests/setup.js`](tests/setup.js) | Test environment setup and per test cleanup. |
| [`tests/helpers/renderWithProviders.jsx`](tests/helpers/renderWithProviders.jsx) | Renders a tree inside the router and session providers, plus fixtures. |
| [`tests/sessions.test.jsx`](tests/sessions.test.jsx) | Real sign out, the device list, and a token shown exactly once. |
| [`tests/validation.test.js`](tests/validation.test.js) | Field validator and password scoring tests. |
| [`tests/download.test.js`](tests/download.test.js) | That a download endpoint is fetched as a file and reaches the browser intact. |
| [`tests/routing.test.jsx`](tests/routing.test.jsx) | Route guard and redirect tests. |
| [`tests/organization.test.jsx`](tests/organization.test.jsx) | Organization creation, availability, contact email and deletion tests. |
| [`tests/editor.test.jsx`](tests/editor.test.jsx) | Archive download, adding languages, merging keys and the compare dropdown. |
| [`tests/locales.test.js`](tests/locales.test.js) | Locale catalogue, A to Z indexing, search and code validation. |
| [`tests/exportFormat.test.jsx`](tests/exportFormat.test.jsx) | Format selection on the editor download and the format management page. |
| [`tests/consistency.test.jsx`](tests/consistency.test.jsx) | Per key updates, the refresh control, the consistency report and the offline platform warning. |
| [`tests/accountAi.test.jsx`](tests/accountAi.test.jsx) | Namespace AI credentials, the fallback chain and the optional embedding model. |
| [`tests/chat.test.jsx`](tests/chat.test.jsx) | The three panes, attachments, tool reporting, search and embedding backfill. |
| [`tests/projectCredentials.test.jsx`](tests/projectCredentials.test.jsx) | That project settings enters no key, and reports the account chain covering its platform. |

## Agent Configuration

| Directory / File | Purpose |
|---|---|
| [`.agents/`](.agents/) | Agent configuration for this repository only. |
| [`.agents/knowledge/`](.agents/knowledge/) | Domain context for this codebase. |
| [`.agents/knowledge/domain.md`](.agents/knowledge/domain.md) | Product concepts, routing model and interface conventions. |
| [`.agents/security/`](.agents/security/) | Security policies applying to this repository. |
| [`.agents/security/xss.md`](.agents/security/xss.md) | Cross site scripting prevention in React. |
| [`.agents/security/secrets-management.md`](.agents/security/secrets-management.md) | Why no secret belongs in a browser bundle. |
| [`.agents/security/authentication-failures.md`](.agents/security/authentication-failures.md) | Token storage and session handling. |
| [`.agents/security/broken-access-control.md`](.agents/security/broken-access-control.md) | Why client guards are presentation, not security. |
| [`.agents/security/csrf.md`](.agents/security/csrf.md) | Why bearer tokens avoid CSRF, and what would reintroduce it. |
| [`.agents/security/secure-file-upload.md`](.agents/security/secure-file-upload.md) | Client side upload checks and their limits. |
| [`.agents/security/sensitive-information-disclosure.md`](.agents/security/sensitive-information-disclosure.md) | What must never be rendered or logged. |
| [`.agents/security/supply-chain.md`](.agents/security/supply-chain.md) | Dependency policy for a browser bundle. |
| [`.agents/security/security-misconfiguration.md`](.agents/security/security-misconfiguration.md) | Build output and serving headers. |
| [`.agents/security/exceptional-conditions.md`](.agents/security/exceptional-conditions.md) | Error rendering without leaking detail. |

## Documentation

| Directory / File | Purpose |
|---|---|
| [`wiki/`](wiki/) | Human facing documentation root directory. |
| [`wiki/api.md`](wiki/api.md) | API specifications and endpoints consumed by this client. |
| [`wiki/environment.md`](wiki/environment.md) | Environment configuration, variables and infrastructure examples. |
| [`wiki/requirements.md`](wiki/requirements.md) | Project requirements. |
| [`wiki/system.md`](wiki/system.md) | System architecture documentation. |
