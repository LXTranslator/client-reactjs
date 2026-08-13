# 0.16.0

The client adopts the LXAgents shared agent instruction set, served by the
`lxagents-agents-base` MCP connector, and moves its documentation into the two tree
layout the shared directory architecture mandates.

This entry is the first change log this repository carries; it records the instruction
system adoption rather than the application history that preceded it. The application
version was not bumped for this change.

## Added

- `.agents/index/` — the centralized router and its scope indexes: `root-index.md`,
  `agents-index.md`, `agent-wiki-index.md`, `project-wiki-index.md`, `memory-index.md`
  and `logs-index.md`. The root index carries the shared override table, currently empty.
- `.agents/rules/repository.md` — the rules that are specific to this repository: layer
  boundaries, the non negotiables, how to add a page, coding style and the test approach.
- `.agents/wiki/context/repository-map.md` — orientation for an agent before it touches
  the codebase.
- `.agents/memory/state/repository-state.md` and `.agents/memory/tasks/agents-setup.md` —
  the memory seed.
- `wiki/information/overview.md`, `wiki/environments/setup.md` and
  `wiki/environments/docker.md`.
- This change log, and the `wiki/logs/` tree that holds it.

## Changed

- `AGENTS.md` is now an entry point and activation contract only. It carries the
  connector bootstrap block, the auto activation contract, the trigger table, the reading
  order, the routing protocol, the iron rule, the placement summary, the discovery
  protocol and the version and session link rules — and no rule bodies. Everything
  specific to this repository moved to `.agents/rules/repository.md`; everything
  universal is now read from the connector instead of being restated here.
- `README.md` is an overview only, pointing at the wiki index for the full map.
- Documentation moved into the mandated folder layout: `DESIGN.md` to
  `wiki/information/design-system.md`, `wiki/system.md` to
  `wiki/information/architecture.md`, `wiki/requirements.md` to
  `wiki/information/requirements.md`, `wiki/api.md` to `wiki/reference/api.md`, and
  `wiki/environment.md` to `wiki/environments/env.md`.
- Every file under `.agents/` now carries kebab-case frontmatter `name` values, unique
  within the local set, so that a name collision with the shared set means an override
  and nothing else.

## Removed

- `INDEX.md`. The shared directory architecture forbids an `INDEX.md` anywhere; its
  routing role is now served by `.agents/index/`, and the file inventory it carried is
  distributed across the scope indexes that own each tree.
- The `## Git` section of `AGENTS.md`, which restated the shared branching strategy and
  commit conventions. Both are now read from the connector, so they can no longer drift
  from the organization's set.
