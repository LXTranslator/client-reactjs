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

The namespace scoped routes carry no namespace segment:

```
/namespaces/settings
/namespaces/settings/members
/namespaces/projects
```

They act on the **active namespace**. Project and file routes do carry
identifiers, because those are globally unique:

```
/namespaces/project/:projectId
/namespaces/project/:projectId/file/:fileId
```

Do not add a namespace segment to the first group. The route shape is agreed with
the backend and matches the product specification.

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
