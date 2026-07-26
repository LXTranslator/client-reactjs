---
name: Product Domain and Interface Conventions
description: Concepts, routing model and conventions an agent must understand before changing the LXTranslator client.
---

# Product Domain and Interface Conventions

## Vocabulary

| Term | Meaning |
|---|---|
| **Namespace** | An account that owns projects. Either a person (`USER`) or an organization (`ORG`). There is no separate users concept. |
| **Active namespace** | Which namespace the namespace scoped pages act on. Held in `AuthContext`, switched from the header. |
| **Project** | A collection of translation files sharing one AI provider, model and set of API keys. |
| **File** | One uploaded locale document, for example `en_us.json`. |
| **Master** | The English (`en_us`) text. Every other language is derived from it. |
| **Text hash** | A 36 character fingerprint of the master text, exported beside every translation. |
| **Stale translation** | One whose recorded `source_hash` no longer matches its key's current `text_hash`, meaning the English source changed after it was translated. |

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

**Styling.** Compose the components in `DESIGN.md` section 4. Add a per section
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
