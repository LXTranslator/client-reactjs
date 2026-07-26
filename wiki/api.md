# API Reference

The API surface this client consumes, as seen from the browser. The server's own
reference is authoritative; this documents how the client uses it and which
helper corresponds to each endpoint.

Base path: `/api/v1`, configurable at build time through `VITE_API_BASE_URL`.

## Conventions

Every call goes through `src/lib/apiClient.js`. It attaches the bearer token,
unwraps the response envelope and turns a failure into an `ApiError`.

```js
import { api } from '../lib/apiClient.js';

const result = await api.listProjects('acme_corp');
// result is the `data` payload; the envelope is already removed.
```

### Errors

`ApiError` carries the status, a stable code and any field level detail:

```js
try {
  await api.createProject(namespace, payload);
} catch (error) {
  error.status;        // 409
  error.code;          // 'CONFLICT'
  error.message;       // client safe text from the server
  error.fieldErrors;   // { name: 'That project name is taken.' }
  error.isUnauthorized // true when the session expired
}
```

Pages map `fieldErrors` back onto their form fields, so a server side rejection
lands on the field that caused it.

A network failure becomes an `ApiError` with status `0` and code
`NETWORK_ERROR`, so a page never has to distinguish a transport failure from an
API failure.

## Authentication

| Helper | Endpoint | Used by |
|---|---|---|
| `api.checkAvailability({user_id})` | `GET /auth/availability` | Registration, organization creation |
| `api.checkAvailability({email})` | `GET /auth/availability` | Registration, organization creation |
| `api.register(body)` | `POST /auth/register` | Registration |
| `api.login(body)` | `POST /auth/login` | Sign in |
| `api.forgotPassword(body)` | `POST /auth/password/forgot` | Forgot password |
| `api.resetPassword(body)` | `POST /auth/password/reset` | Reset password |
| `api.me()` | `GET /auth/me` | Session restore |

Registration and login both return `access_token`, which the client stores in
session storage and attaches to every subsequent request.

Forgot password always succeeds with the same message whether or not the address
is registered. Outside production the response also carries
`development_token`, which the page surfaces as a link so the flow can be
completed without an inbox.

## Account settings

Sensitive changes are a two step flow. The token is held in component state
only, never stored, and discarded once spent.

| Helper | Endpoint |
|---|---|
| `api.confirmPassword({password})` | `POST /settings/confirm` |
| `api.updateUserId({token, user_id})` | `PATCH /settings/identifier` |
| `api.updateEmail({token, email})` | `PATCH /settings/email` |
| `api.updatePassword({token, password, confirm_password})` | `PATCH /settings/password` |
| `api.updateProfile(body)` | `PATCH /settings/profile` |

`confirmPassword` returns a token valid for `expires_in` seconds (600) and usable
exactly once. Spending it on a second change returns 401, so the client clears it
after every use and asks for the password again.

`updateProfile` needs no token, since display fields cannot be used to take over
an account.

## Namespaces and organizations

| Helper | Endpoint |
|---|---|
| `api.listNamespaces()` | `GET /namespaces` |
| `api.createOrganization(body)` | `POST /namespaces/organizations` |
| `api.getNamespace(namespace)` | `GET /namespaces/:namespace` |
| `api.updateNamespace(namespace, body)` | `PATCH /namespaces/:namespace/settings` |
| `api.deleteNamespace(namespace, confirmUserId)` | `DELETE /namespaces/:namespace` |
| `api.listMembers(namespace)` | `GET /namespaces/:namespace/settings/members` |
| `api.addMember(namespace, body)` | `POST /namespaces/:namespace/settings/members` |
| `api.updateMember(namespace, memberId, body)` | `PATCH /namespaces/:namespace/settings/members/:memberId` |
| `api.removeMember(namespace, memberId)` | `DELETE /namespaces/:namespace/settings/members/:memberId` |

`listNamespaces` returns a summary per namespace including the caller's role.
`getNamespace` returns the full profile, including `email`, which the summary
omits, so the settings page fetches it separately.

### The organization contact email

`updateNamespace` accepts `email`, the organization's **own** address. It is
deliberately separate from every member's personal address so billing and
account notices reach the organization rather than whoever created it, who may
later leave. A collision with another account returns **409**.

### Deletion

`deleteNamespace` sends the identifier in the body:

```js
await api.deleteNamespace('acme_corp', 'acme_corp');
```

The server refuses the call unless the caller is `OWNER`, the echoed identifier
matches, and the namespace is an organization rather than a personal one. The
interface adds a two step confirmation on top: retype the identifier, then
confirm.

## Projects and credentials

| Helper | Endpoint |
|---|---|
| `api.listProjects(namespace)` | `GET /namespaces/:namespace/projects` |
| `api.createProject(namespace, body)` | `POST /namespaces/:namespace/projects` |
| `api.getProject(projectId)` | `GET /projects/:projectId` |
| `api.updateProject(projectId, body)` | `PATCH /projects/:projectId/settings` |
| `api.deleteProject(projectId)` | `DELETE /projects/:projectId` |
| `api.listApiKeys(projectId)` | `GET /projects/:projectId/keys` |
| `api.addApiKey(projectId, body)` | `POST /projects/:projectId/keys` |
| `api.updateApiKey(projectId, keyId, body)` | `PATCH /projects/:projectId/keys/:keyId` |
| `api.removeApiKey(projectId, keyId)` | `DELETE /projects/:projectId/keys/:keyId` |
| `api.reorderApiKeys(projectId, ids)` | `POST /projects/:projectId/keys/reorder` |
| `api.listProviders()` | `GET /providers` |

**No endpoint returns a stored key.** A credential is identified by its label and
`masked_key`, which shows only the last four characters. The interface never has
a key to display, so it cannot leak one.

`reorderApiKeys` must list every key on the project exactly once. The order is
the order the server's fallback chain walks.

`listProviders` drives the provider and model selects, so adding a provider on
the server surfaces in the interface with no client change.

## Files and translations

| Helper | Endpoint |
|---|---|
| `api.listFiles(projectId)` | `GET /projects/:projectId/files` |
| `api.uploadFile(projectId, formData)` | `POST /projects/:projectId/files` |
| `api.getFile(fileId)` | `GET /files/:fileId` |
| `api.deleteFile(fileId)` | `DELETE /files/:fileId` |
| `api.reprocessFile(fileId)` | `POST /files/:fileId/reprocess` |
| `api.getTranslations(fileId)` | `GET /files/:fileId/translations` |
| `api.updateTranslation(fileId, translationId, body)` | `PATCH /files/:fileId/translations/:translationId` |
| `api.updateMasterText(fileId, keyId, body)` | `PATCH /files/:fileId/keys/:keyId` |
| `api.retranslateKeys(fileId, body)` | `POST /files/:fileId/keys/retranslate` |
| `api.checkConsistency(fileId, lang)` | `GET /files/:fileId/consistency` |
| `api.downloadLocale(fileId, lang, exportFormat)` | `GET /files/:fileId/download?lang=` |
| `api.downloadAll(fileId, exportFormat)` | `GET /files/:fileId/download` |
| `api.downloadArchive(fileId, exportFormat)` | `GET /files/:fileId/download?format=zip` |
| `api.listFileExportFormats(fileId)` | `GET /files/:fileId/export_formats` |

## The assistant

| Helper | Endpoint |
|---|---|
| `api.sendChat(namespace, payload)` | `POST /namespaces/:namespace/chat` |
| `api.getChatSession(namespace, sessionId)` | `GET /namespaces/:namespace/chat/sessions/:sessionId` |
| `api.searchChats(namespace, query, limit)` | `GET /namespaces/:namespace/chat/search` |
| `api.backfillChatEmbeddings(namespace, body)` | `POST /namespaces/:namespace/chat/embeddings` |
| `api.getChatLogBuffer(namespace)` | `GET /namespaces/:namespace/chat/log_buffer` |

`sendChat` takes either a JSON body or a `FormData`. Multipart is used only when
a locale file is attached, since the browser must set the boundary itself and
the common case is better off as JSON.

The response describes what happened, not only what was said:

```json
{
  "session_id": "...",
  "answer": "You have two projects.",
  "namespace": "acme_corp",
  "tool_calls": [{ "name": "list_projects", "ok": true }],
  "steps": 2,
  "stopped_by_tool": false,
  "token_usage": 812,
  "total_token_usage": 3140
}
```

The context pane renders that rather than leaving it implicit in the prose. A
refused tool arrives as `ok: false` with an `error`, and is shown as refused,
because the server checks permission on every call and the answer above may be
describing a refusal. `namespace` can differ from the one in the path when the
assistant switched context, which the pane says out loud since the URL no longer
describes what it is acting on.

There is no endpoint that lists a person's sessions, so the conversations pane
keeps the handful this browser has open in local storage and finds anything else
through search. `searchChats` reports `method`, which is `EMBEDDING` or `TEXT`,
and the pane says which: somebody searching by meaning and finding nothing
deserves to know no embedding model is configured.

## Namespace AI credentials

| Helper | Endpoint |
|---|---|
| `api.listAccountKeys(namespace)` | `GET /namespaces/:namespace/settings/ai_keys` |
| `api.addAccountKey(namespace, body)` | `POST /namespaces/:namespace/settings/ai_keys` |
| `api.updateAccountKey(namespace, keyId, body)` | `PATCH /namespaces/:namespace/settings/ai_keys/:keyId` |
| `api.removeAccountKey(namespace, keyId)` | `DELETE /namespaces/:namespace/settings/ai_keys/:keyId` |
| `api.reorderAccountKeys(namespace, orderedKeyIds)` | `POST /namespaces/:namespace/settings/ai_keys/reorder` |

These pay for what a namespace does outside a single project, which today means
the assistant. A project keeps its own keys for translating.

Inside an organization every one of these needs `ADMIN`, **reading included**,
because the list is a statement about the organization's spending. A member
receives **403** rather than an empty list, and the page explains that rather
than rendering as though nothing is configured.

Unlike a project credential, each row names its own platform and models, since
an account has no record to take them from. Order is meaningful: it is the order
the server's fallback chain walks, and inside an organization the caller's own
personal credentials follow the organization's.

`embedding_model` is optional and omitting it is the ordinary case. With none
configured the assistant works exactly as it otherwise would and conversation
search matches text rather than meaning. A platform that serves no embeddings,
such as Anthropic, reports an empty `embedding_models` list and the field is
disabled with an explanation.

No endpoint returns a stored key, and no view renders one.

## Export formats

| Helper | Endpoint |
|---|---|
| `api.listExportFormats(namespace)` | `GET /namespaces/:namespace/export_formats` |
| `api.createExportFormat(namespace, body)` | `POST /namespaces/:namespace/export_formats` |
| `api.updateExportFormat(namespace, formatId, body)` | `PATCH /namespaces/:namespace/export_formats/:formatId` |
| `api.removeExportFormat(namespace, formatId)` | `DELETE /namespaces/:namespace/export_formats/:formatId` |

A format describes the shape a downloaded locale document is written in, and it
belongs to a namespace rather than to a project, so one description serves every
project underneath.

Two ship with the server and appear in every namespace: `default`, which carries
the translated string beside the fingerprint of the English master, and
`key_value`, which carries the bare string. Both are marked `built_in` and the
server refuses to change or remove either, so the interface shows no control
that would fail.

### Upload

Multipart, built by the page:

```js
const formData = new FormData();
formData.append('file', file);
formData.append('source_lang', 'en_us');
formData.append('target_langs', JSON.stringify(['th_th', 'ja_jp']));

await api.uploadFile(projectId, formData);
```

The client deliberately does not set `Content-Type`; the browser must set the
multipart boundary itself.

Returns **202**: the record exists but the pipeline is still running. The
interface polls `getFile` until `status` is `READY` or `FAILED`.

### Editor payload

`getTranslations` returns the master text, every locale, and
`stale_translations`, which lists rows whose recorded `source_hash` no longer
matches the key's current `text_hash`. That is how the editor knows which
translations have fallen behind their source.

Editing a master string through `updateMasterText` restamps its hash, which is
exactly what marks its translations stale. The response says whether the text
really moved and which languages fell behind:

```json
{
  "key": { "id": "...", "text_hash": "new_hash_value" },
  "changed": true,
  "stale_lang_codes": ["th_th"]
}
```

`changed` is `false` when the submitted text equals the stored text, and the
editor says so rather than claiming a save that did not happen.

### Refreshing keys

`retranslateKeys` refreshes the keys named and nothing else, which is what the
per key update control uses. The rerun endpoint would send every key in the file
to a provider to update one of them.

Returns **202**, so the editor returns to polling exactly as it does after an
upload. A translation flagged `is_manual` survives unless its English source
moved.

### Key consistency

`checkConsistency` compares the placeholders and tags of every language against
the master and reports missing tokens, invented tokens, missing rows, empty rows
and stale rows.

It runs when a person asks and never on a keystroke: the server reads every key
and every translation of the file to answer it. `issue_count` is exact; `issues`
stops at 500 entries and sets `truncated`, which the panel says out loud.

### Download

Both download helpers return JSON through the authenticated client rather than
pointing an anchor at the endpoint, because a plain link cannot carry the
Authorization header. `src/lib/download.js` then hands the result to the browser
as a file.

`format` and `export_format` answer different questions and stay separate here
as they do on the server: `format` is how the download is packaged, and
`export_format` is the shape of the documents inside it. The client omits
`export_format` entirely when the default is selected, so a URL it produces is
identical to the one it produced before formats existed.

In the `default` format each exported leaf carries the value and its tracking
hash:

```json
{
  "greeting": {
    "hello": {
      "value": "สวัสดี {name}",
      "hash": "123e4567-e89b-12d3-a456-426614174000"
    }
  }
}
```

In `key_value` the same locale comes back ready to use as it is:

```json
{ "greeting": { "hello": "สวัสดี {name}" } }
```

That trade is real and the editor says so when the format is selected: a
document with no fingerprint cannot tell a consumer that its English source
changed. The stale markers in the editor still do.
