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

## Projects

| Helper | Endpoint |
|---|---|
| `api.listProjects(namespace)` | `GET /namespaces/:namespace/projects` |
| `api.createProject(namespace, body)` | `POST /namespaces/:namespace/projects` |
| `api.getProject(projectId)` | `GET /projects/:projectId` |
| `api.updateProject(projectId, body)` | `PATCH /projects/:projectId/settings` |
| `api.deleteProject(projectId)` | `DELETE /projects/:projectId` |
| `api.listProviders()` | `GET /providers` |

**A project holds no credentials.** It names a platform and a model, and the key
that pays for a translation comes from the account that owns it. There is no
`api.listApiKeys` or `api.addApiKey`; use the account credential helpers below.
The settings page reads the account chain to say whether the platform it names
can actually be paid for, and links to the page that manages it.

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

The three download helpers all resolve to a **`Blob`**, not to a parsed
document. Those endpoints set `Content-Disposition` and send the document
itself, with none of the `{ data }` envelope every other endpoint uses, so
asking for one as JSON makes the unwrapper look for a `data` field that does not
exist and hand back `null`.

The bytes the server produced are the bytes that reach the disk. The client does
not parse a document and write it out again: the server already chose the shape,
the field names and the indentation of the selected export format, and
re-serialising them here can only lose something.

`triggerDownload` in `src/lib/download.js` is the only place a blob becomes a
file. It releases the object URL on a timer rather than on the next line,
because a click only *starts* a download and revoking the URL in the same task
cancels one the browser has not finished reading.

## The assistant

| Helper | Endpoint |
|---|---|
| `api.sendChat(namespace, payload)` | `POST /namespaces/:namespace/chat` |
| `api.listChatSessions(namespace)` | `GET /namespaces/:namespace/chat/sessions` |
| `api.getChatSession(namespace, sessionId)` | `GET /namespaces/:namespace/chat/sessions/:sessionId` |
| `api.renameChatSession(namespace, sessionId, title)` | `PATCH /namespaces/:namespace/chat/sessions/:sessionId` |
| `api.deleteChatSession(namespace, sessionId)` | `DELETE /namespaces/:namespace/chat/sessions/:sessionId` |
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
  "downloads": [],
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

The tools the assistant may call include `create_project` for a new project and
`upload_file` for one that already exists, so an attached file reaches either
without a project ever needing to be deleted or recreated. `add_keys` adds new
strings to a file that is already there, keeping its identifier and everything
in it, which is the same merge `mergeFileKeys` performs from the editor. They also cover a
project's AI platform and model, and the export formats a namespace offers, so
the assistant can set those rather than reporting them as unsupported.

`downloads` holds what `export_file` offered on this turn:

```json
{
  "file_id": "...",
  "filename": "thai_strings.json",
  "lang": "th_th",
  "langs": ["th_th"],
  "export_format": "flat_key_value",
  "format_name": "Flat key and value"
}
```

Each entry is a reference rather than a document, so the conversation pane
renders one as a button and fetches the bytes through `downloadLocale`, or
`downloadArchive` when `lang` is `null`, exactly as the editor does. `filename`
is what it saves as, which the person may have asked for by name.

They arrive with the answer and are not stored on the exchange, so
`getChatSession` replays a conversation without them. The page therefore keeps
them on the newest answer only.

`ChatContextPane` names each call in a person's words. A tool with no entry in
its label map falls through to the raw name, so a tool added on the server
appears as soon as it is used; the map makes an action readable rather than
making it visible.

The conversations pane lists what the server holds, so the same conversations
appear on every machine somebody signs in from. Each arrives already named,
after the question that opened it; `renameChatSession` replaces that, and an
empty title clears it back to the derived one. `deleteChatSession` removes the
conversation and every turn in it, which is why the pane asks first.

Search sits above the list because the two answer different questions: the list
covers what somebody was just doing, search covers what was decided last month.
`searchChats` reports `method`, which is `EMBEDDING` or `TEXT`, and the pane says
which: somebody searching by meaning and finding nothing deserves to know no
embedding model is configured.

## Sessions and API tokens

| Helper | Endpoint |
|---|---|
| `api.logout()` | `POST /auth/logout` |
| `api.listSessions()` | `GET /auth/sessions` |
| `api.revokeSession(sessionId)` | `DELETE /auth/sessions/:sessionId` |
| `api.revokeOtherSessions()` | `POST /auth/sessions/revoke_others` |
| `api.listApiTokens()` | `GET /auth/api_tokens` |
| `api.createApiToken(body)` | `POST /auth/api_tokens` |
| `api.revokeApiToken(tokenId)` | `DELETE /auth/api_tokens/:tokenId` |
| `api.listUsage({ sessionId, limit })` | `GET /auth/usage` |
| `api.getUsageSummary(days)` | `GET /auth/usage/summary` |

Signing out calls the server. Dropping the token locally only makes this browser
forget it; the token stays valid until it expires anywhere else it reached,
which on a borrowed machine is the difference between signing out and appearing
to. A failure is swallowed and the local session is cleared anyway, because
somebody who pressed sign out must end up signed out here whatever the network
did.

Ending the *current* session from the session list goes through the same sign
out rather than calling `revokeSession` directly. Revoking the row would end the
session on the server and leave this browser holding a token it does not know is
dead, showing a signed in interface until the next request failed.

The activity panel sits directly under the credential lists rather than on a
page of its own, because the question it answers is the one those lists provoke:
"there is a token here I do not recognise, what has it been doing". Two screens
apart, nobody asks it. The summary is shown above the log for the same reason: a
page of log lines answers "what happened" and not "is anything wrong".

A row names its credential rather than showing an identifier, and reads
"Removed credential" when that credential is gone. The record outlives the
credential on purpose, so that case is normal rather than an error.

`createApiToken` returns the token once. It is held on screen until dismissed
rather than shown in a notice that disappears, because nothing can show it
again: the server stores a digest and the last four characters.

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

Each row names its own platform and models, which is what lets one account hold
credentials for several vendors at once: a project on OpenAI and a project on
Anthropic draw on different parts of the same chain. Order is meaningful: it is the order
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

Three ship with the server and appear in every namespace: `default`, which
carries the translated string beside the fingerprint of the English master;
`key_value`, which carries the bare string; and `flat_key_value`, which carries
the bare string with the dotted path left whole. All are marked `built_in` and
the server refuses to change or remove any of them, so the interface shows no
control that would fail.

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

In `flat_key_value` the nesting is left alone entirely, so a consumer reads one
key path out of one flat map:

```json
{ "greeting.hello": "สวัสดี {name}" }
```

That trade is real and the editor says so when the format is selected: a
document with no fingerprint cannot tell a consumer that its English source
changed. The stale markers in the editor still do.
