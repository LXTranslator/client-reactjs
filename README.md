# Project Overview

* **Platform:** [github.com](https://github.com)
* **Organization:** [LXTranslator](https://github.com/LXTranslator)
* **Repository:** [client-reactjs](https://github.com/LXTranslator/client-reactjs)

---

## LXTranslator Client

The web interface for LXTranslator, a translation management application. It lets a team
upload JSON locale files, watch them being translated, correct anything the model got
wrong, and download the finished locale files with change tracking built in.

Built with React and React Router, bundled by Vite, and styled with the Silver Glass
design system.

## What it does

* **Namespaces.** Every project belongs to a namespace — a person or an organization.
* **Organizations.** Create one with live availability checking, invite members and assign
  roles.
* **Projects.** Choose an AI provider and model; credentials come from the namespace that
  pays for the work.
* **Uploads.** Pick target languages, drop in a `.json` file, and watch it being processed.
* **Translation editor.** Correct any string, and see which translations went stale when
  the English changed.
* **The assistant.** A three pane chat that can act on a project and hand back downloads.
* **Downloads.** Export one locale or all of them, in any configured export format.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test
npm run build      # production bundle into dist/
```

The dev server proxies `/api` to `http://localhost:4000`, so run the
[`server-expressjs`](https://github.com/LXTranslator/server-expressjs) backend alongside
it. The backend needs no configuration of its own.

## Documentation

Start here:

| Document | Contents |
|---|---|
| [`wiki/information/overview.md`](wiki/information/overview.md) | What the client is, who it is for, and what it does. |
| [`wiki/environments/setup.md`](wiki/environments/setup.md) | Local setup, the commands, and how the tests are run. |
| [`wiki/information/architecture.md`](wiki/information/architecture.md) | Routing, state management and the style layers. |

The full map of the documentation is
[`.agents/index/project-wiki-index.md`](.agents/index/project-wiki-index.md).

## Working with agents

[`AGENTS.md`](AGENTS.md) is the entry point for AI agents working in this repository. The
organization wide conventions it relies on are not stored here — they are served by the
`lxagents-agents-base` MCP connector and resolved at session start.

## License

Proprietary. Reserved for the LXTranslator organization. See [`LICENSE`](LICENSE).

Created by Jetsada Wijit.
