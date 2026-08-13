# Overview

The web interface for LXTranslator, a translation management application. It lets a team
upload JSON locale files, watch them being translated, correct anything the model got
wrong, and download the finished locale files with change tracking built in.

It is a browser application and nothing more. Every rule about who may see what is
enforced by the backend, `LXTranslator/server-expressjs`; this client renders what that
server allows and never makes an authorization decision of its own.

## Who it is for

Teams who ship software in more than one language and want the translation of their
locale files managed in one place — with a human able to correct the machine, and with
enough tracking to know which translations went stale when the English changed.

## What it does

* **Namespaces.** Every project belongs to a namespace, which is either a person or an
  organization. The header switches between them.
* **Organizations.** Create one on its own page with live availability checking, invite
  members, assign roles, and keep an organization contact address separate from anybody's
  personal address.
* **Projects.** Choose an AI provider and model. A project holds no credentials of its
  own; it draws on the credential chain belonging to the namespace that pays for it.
* **Uploads.** Pick target languages, drop in a `.json` file, and watch it being
  processed.
* **Translation editor.** Read each English master string beside its translation, correct
  anything, and see which translations have gone stale because the source changed.
* **Consistency checks.** Run a placeholder and coverage check against the master on
  demand.
* **The assistant.** A three pane chat that can act on a project — attach files, report
  what it did and what it cost, and offer the results as downloads.
* **Downloads.** Export one locale or all of them, in any configured export format, each
  carrying the tracking hash alongside every value.

## How it is built

React with React Router, bundled by Vite, written as ES modules against Node.js 20 or
newer. State lives in a session context; everything that talks to the server goes through
a single API client, so token handling and error shaping cannot drift between pages.
Styling comes from the Silver Glass design system, described in
[`design-system.md`](design-system.md).

The structure behind all of that is in [`architecture.md`](architecture.md); the API this
client consumes is in [`../reference/api.md`](../reference/api.md).

## Constraints worth knowing up front

* **The bundle is public.** Every value inlined at build time is readable by anyone who
  opens the network tab, so nothing secret is ever configured here. See
  [`../environments/env.md`](../environments/env.md).
* **Route guards are presentation.** They decide what to render, not what a user may
  reach. The server authorizes every request.
* **The API speaks snake_case**, JavaScript here speaks camelCase, and the boundary
  between them is the API client.
