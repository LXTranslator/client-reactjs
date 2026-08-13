---
name: memory-state-repository-state
description: Current known state of client-reactjs after adopting the shared instruction set — what exists, the stack, and the next obvious step.
---

# Repository State — client-reactjs

## What this is

`lxtranslator_client`, version 0.16.0. The React single page application for
LXTranslator, consuming the API served by `LXTranslator/server-expressjs`.

## Stack

React with React Router, Vite, ES modules, Node.js 20 or newer. Vitest and Testing
Library for tests. Deployed as a multi stage Docker image serving the built bundle
through nginx, with the server configuration rendered from `nginx.conf.template` at
container start up.

## Instruction system

Mode B consumer. The shared set resolves through the `lxagents-agents-base` MCP
connector; nothing shared is copied into this repository, and the override table in
`.agents/index/root-index.md` is empty. Local content is:

* `.agents/rules/repository.md` — this repository's own rules.
* `.agents/knowledge/domain.md` — product vocabulary and the routing model.
* `.agents/security/` — ten policies written for a public browser bundle.
* `.agents/wiki/context/repository-map.md` — agent orientation.
* `.agents/index/` — six indexes routing all of the above plus both wiki trees.

Human documentation lives in `wiki/` under `information/`, `reference/`, `environments/`
and `logs/`.

## What is not built

* No change log history before 0.16.0 — the `wiki/logs/` tree starts at the version
  current when the instruction system was adopted.
* No CI workflow in this repository.
* No `.agents/wiki/sop/` or `.agents/wiki/domain/` pages yet; only `context/` is
  populated.

## Next obvious step

The eight security topics this repository shares by filename with
`LXTranslator/server-expressjs` have different bodies in each repository because one is a
browser bundle and the other is a server. Whether any of them should be promoted to the
shared set is an open question for the user; it would be a change to `LXAgents/mcp-server`
and has not been made.
