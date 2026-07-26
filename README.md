# Project Overview

* **Platform:** [github.com](https://github.com)
* **Organization:** [LXTranslator](https://github.com/LXTranslator)
* **Repository:** [client-reactjs](https://github.com/LXTranslator/client-reactjs)

---

## LXTranslator Client

The web interface for LXTranslator, a translation management application. It
lets a team upload JSON locale files, watch them being translated, correct
anything the model got wrong, and download the finished locale files with change
tracking built in.

Built with React and React Router, styled with the Silver Glass design system
described in [`DESIGN.md`](DESIGN.md).

## What it does

* **Namespaces.** Every project belongs to a namespace, which is either a person
  or an organization. The header switches between them.
* **Organizations.** Create one on its own page with live availability checking,
  invite members, assign roles, and keep an organization contact address
  separate from anybody's personal address.
* **Projects.** Choose an AI provider and model, and manage a priority ordered
  list of API keys that the server falls back through when one fails.
* **Uploads.** Pick target languages, drop in a `.json` file, and watch it being
  processed.
* **Translation editor.** Read each English master string beside its
  translation, correct anything, and see which translations have gone stale
  because the source changed.
* **Downloads.** Export one locale or all of them, each carrying the tracking
  hash alongside every value.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 61 tests
npm run build      # production bundle into dist/
```

The dev server proxies `/api` to `http://localhost:4000`, so run the
[`server-expressjs`](https://github.com/LXTranslator/server-expressjs) backend
alongside it. The backend needs no configuration of its own.

## Documentation

| Document | Contents |
|---|---|
| [`INDEX.md`](INDEX.md) | Repository structure index. |
| [`DESIGN.md`](DESIGN.md) | The Silver Glass design system, and how it is applied here. |
| [`wiki/requirements.md`](wiki/requirements.md) | Functional and non functional requirements. |
| [`wiki/api.md`](wiki/api.md) | The API surface this client consumes. |
| [`wiki/environment.md`](wiki/environment.md) | Environment variables and infrastructure examples. |
| [`wiki/system.md`](wiki/system.md) | Architecture, routing and state management. |

## License

Proprietary. Reserved for the LXTranslator organization. See [`LICENSE`](LICENSE).

Created by Jetsada Wijit.
