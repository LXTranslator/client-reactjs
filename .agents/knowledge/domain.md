---
name: product-domain
description: Concepts, routing model and conventions an agent must understand before changing the LXTranslator client.
---

# Product Domain and Interface Conventions

## Vocabulary

| Term | Meaning |
|---|---|
| **Namespace** | An account that owns projects. Either a person (`USER`) or an organization (`ORG`). There is no separate users concept. |
| **Active namespace** | Which namespace the namespace scoped pages act on. Held in `AuthContext`, switched from the header. |
| **Project** | A collection of translation files sharing one AI platform and model. It holds no keys: those belong to the account that owns it. |
| **File** | One uploaded locale document, for example `en_us.json`. |
| **Master** | The English (`en_us`) text. Every other language is derived from it. |
| **Text hash** | A 36 character fingerprint of the master text, exported beside every translation. |
| **Stale translation** | One whose recorded `source_hash` no longer matches its key's current `text_hash`, meaning the English source changed after it was translated. |
| **Offline platform** | One the catalogue reports with `requires_network: false`, today only the built in mock. It contacts no vendor and returns the source text with a locale marker in front of it (`[th:711f] Dirt`). |

## Concepts that are easy to get wrong

1. **English is always the master.** A file uploaded in another language is
   translated into `en_us` first, and every target is derived from that master.
   The editor shows the master beside each translation for exactly this reason.
2. **Editing a master string marks its translations stale.** That is intended
   behaviour, not a bug, and the interface says so before the edit is saved.
3. **A namespace identifier comes from one pool.** A personal user id and an
   organization id can collide, which is why both forms check availability the
   same way.
4. **An organization has its own email.** It is not the creator's address.
5. **A download endpoint is a file, not a resource.** `?lang=`, `?format=zip`
   and the bare download path all send the document itself rather than the
   `{ data }` envelope. Fetch them with `responseType: 'blob'` and pass the blob
   straight to `triggerDownload`; unwrapping one yields `null`, which then gets
   written to disk as the text `null`.
6. **An offline platform produces placeholders, and says nothing about it.** The
   file still reaches `READY` and the editor still fills with rows, so anywhere
   those rows are shown has to say they are not translations. Detect it from the
   catalogue's `requires_network`, never by testing for the name `mock`: which
   platforms are offline is the server's to know.
   Billing and account notices go to the organization, which outlives whoever
   created it.
5. **API keys are never readable.** The interface shows a label and the last four
   characters. There is no view that reveals a key, and none should be added.
6. **Key order is meaningful.** It is the order the server's fallback chain
   walks when a credential fails.

## Routing model

**A namespace is the first path segment.** `/orgA` is the organization `orgA`
and `/jetsada` is that person's namespace, which is also their project list.

```
/:namespace
/:namespace/settings
/:namespace/settings/members
/:namespace/project/:projectId
/:namespace/project/:projectId/uploads
/:namespace/project/:projectId/settings
/:namespace/project/:projectId/file/:fileId
```

Which namespace a page acts on therefore comes from the URL, never from
context. That is what makes every page linkable: two people opening the same
address see the same thing.

A handful of paths belong to no namespace and are matched before it:

```
/                       redirects by session state
/login  /register  /forgot-password  /reset-password
/namespaces             every namespace the visitor can act in
/organizations/new      organization creation
/settings               the signed in account's own credentials
```

Three rules follow, and breaking any of them is a defect:

1. **Build links with `src/lib/paths.js`.** Never assemble a path inline. A
   namespace now appears in nearly every URL, and one wrong segment sends a
   visitor into a namespace that is not theirs.
2. **Read the namespace with `useNamespace()`**, from
   `components/routing/NamespaceRoute.jsx`. It resolves once for every nested
   route, so a page never repeats the lookup and the result is never null.
3. **A new fixed first segment must be reserved.** Add it to
   `RESERVED_SEGMENTS` in `paths.js` *and* to the server's
   `core/reservedIdentifiers.js`, or an account with that name becomes
   unreachable. The two lists are the same list.

Project identifiers are integers from one shared table, so they are unique on
their own; the namespace in the path is context for the reader, and the server
authorises the project by its identifier regardless.

## Growing a file

A locale set is not written once. The editor can add languages and add keys to a
file that already exists, and both are additive by design:

* **Adding a language** translates the existing keys into the new language only.
  A language already on the file is never retranslated.
* **Merging a dropped document** adds only the key names the file lacks. A key
  it already holds is skipped whole, master text and translations included, even
  when the dropped document carries a different value for it.

Say so in the interface rather than leaving it to be discovered. The question a
person has before dropping a file is whether it will overwrite their reviewed
translations, and the answer is no.

Both return **202**: the work finishes on a worker thread, so the page polls the
file's status afterwards exactly as it does after an upload.

**Downloading** offers the whole locale set as `langs.zip`, one entry per
language. Prefer it to looping over the locales and saving each one, which a
browser blocks after the first few downloads anyway.

## Export formats

A download makes two independent choices: how it is packaged, and what shape the
documents inside it take. `format` is the first and `export_format` is the
second, and they stay separate for that reason.

Three formats ship with the server and exist in every namespace. `default` gives
each leaf the translated string beside the fingerprint of the English master;
`key_value` gives the bare string; `flat_key_value` gives the same bare string
with each dotted path kept as one key rather than expanded into a tree. None can
be edited or removed, so the interface renders no control that would fail.

A namespace may describe formats of its own, and every project underneath can
then be downloaded in them. A format is a description rather than a template: a
leaf shape, the field names an object leaf carries, and whether a dotted path
expands into a tree.

Choosing a format with no hash field is a real trade rather than a detail. Such a
document is ready to use as it is and can no longer tell a consumer that its
English source changed, so the editor says so when one is selected.

## Languages

The catalogue in `src/lib/locales.js` holds 143 locales, and codes are not all
two letters: Bavarian is `bar`, Low German `nds_de`, Malay in Jawi script
`zlm_arab`. Anything matching `LOCALE_CODE_PATTERN` is valid whether or not the
catalogue lists it, because the server validates shape rather than membership.
Keep that pattern in step with `LANG_CODE_PATTERN` on the server.

A list that long is never rendered whole. `LocalePicker` opens on a suggested
set and narrows by initial letter or by search, over both the name and the code,
since people arrive knowing one or the other. Initials fold diacritics, so Võro
files under V rather than past Z.

**The master and `en_us` are the same text.** The editor selects a comparison
language from a dropdown, and choosing the master drops the read only column
instead of printing every string twice.

## The assistant

`/:namespace/chat` answers questions about a namespace and acts on it, through a
fixed set of tools on the server.

Three panes, because there are three questions: which conversation, the
conversation itself, and what the assistant actually did.

The third is the one that matters and the one an ordinary chat interface omits.
This assistant creates projects and adds languages, so the difference between
"it says it added Korean" and "it added Korean" is not something a person should
have to infer from prose. Every tool call is listed with its outcome, and a
refused one reads as refused: the server checks permission itself on every call,
so an answer may well be describing a refusal.

Three rules follow:

1. **Render an answer as text, never as markup.** It can quote a project name, a
   locale string or an earlier message, all written by users.
2. **Report a namespace switch.** The assistant may move context mid turn, after
   proving membership, and the path in the URL then no longer describes what it
   is acting on.
3. **Never present a tool result as though the interface performed it.** The
   server did, or refused to.

The conversations pane lists what the server holds, so the same conversations
appear wherever somebody signs in. A conversation arrives already named, after
the question that opened it, and can be renamed or deleted; deleting removes
every turn in it, so it is asked about first.

Search sits alongside the list rather than replacing it, and says whether it
matched by meaning or by text, since an account with no embedding model
configured gets the second and deserves to know why a search found less than
expected.

A locale file can be dropped anywhere on the conversation pane as well as chosen
through the button. Both paths run the same `validateTranslationFile` check: a
dropped file is no more trustworthy than a chosen one.

Files travel the other way too. An answer may arrive offering downloads, which
the conversation pane renders as buttons beneath it, because a file is the thing
being asked for and directions to another screen are not an answer to that. An
offer is a reference rather than a document: the bytes are fetched through the
same authenticated client the editor downloads with, so the server resolves
access for the person clicking. Offers belong to the newest answer, since the
server sends them with the reply rather than storing them on the exchange.

## Interface conventions

**Forms.** Validate on submit with helpers from `src/lib/validation.js`. Clear a
field's error as soon as the user edits it. Give every field a placeholder from
`PLACEHOLDERS`. Map `error.fieldErrors` back onto fields after a server
rejection.

**Async views.** Render all three of loading, empty and error. An empty list must
not look the same as a failed fetch.

**Polling.** Only while something is actually in progress, and stop as soon as it
is not. Two pages poll: project detail and the translation editor.

**Destructive actions.** Confirmation is proportional to what is lost:

| Action | Confirmation |
|---|---|
| Remove a member, delete a file | A single confirm. |
| Delete a project | Retype the project name. |
| Delete an organization | Two dialogs: retype the identifier, then confirm. |

**Styling.** Compose the components in section 4 of `wiki/information/design-system.md`. Add a per section
stylesheet only for genuinely bespoke layout. Never hard code a colour.

## Common mistakes

- Calling `fetch` from a component instead of adding an endpoint helper.
- Treating a route guard or a disabled button as security.
- Adding a namespace segment to the namespace scoped routes.
- Showing an API key, or adding an endpoint that would return one.
- Letting client validation drift from the server's rules, so a user is told
  something is valid and then rejected.
- Polling on a page where nothing is in progress.
- Using `dangerouslySetInnerHTML` to render a translation value.
