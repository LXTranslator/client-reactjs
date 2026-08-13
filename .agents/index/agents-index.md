---
name: agents-index
description: Index of the client-reactjs local instruction set — repository rules, product domain knowledge, and the browser security policies.
---

# Agents Index — client-reactjs

The instruction files this repository owns. Parent: [`root-index.md`](root-index.md).
Shared conventions are not listed here — route to `{shared}/index/root-index.md` for
those.

Any file added to, removed from, or renamed in `.agents/rules/`, `.agents/knowledge/`
or `.agents/security/` is reflected in this index in the same commit.

## rules/

| File | Purpose |
|---|---|
| [`../rules/repository.md`](../rules/repository.md) | Layer boundaries, the non negotiables, how to add a page, coding style and the test approach. |

## knowledge/

| File | Purpose |
|---|---|
| [`../knowledge/domain.md`](../knowledge/domain.md) | Product vocabulary, the namespace routing model and interface conventions. |

## security/

Ten policies, written for a public browser bundle rather than a server.

| File | Purpose |
|---|---|
| [`../security/xss.md`](../security/xss.md) | Keeping attacker controlled content out of the DOM as markup. |
| [`../security/secrets-management.md`](../security/secrets-management.md) | Why no secret belongs in a browser bundle. |
| [`../security/authentication-failures.md`](../security/authentication-failures.md) | Token storage and session handling. |
| [`../security/broken-access-control.md`](../security/broken-access-control.md) | Why client guards are presentation, not security. |
| [`../security/csrf.md`](../security/csrf.md) | Why bearer tokens avoid CSRF, and what would reintroduce it. |
| [`../security/secure-file-upload.md`](../security/secure-file-upload.md) | Client side upload checks and their limits. |
| [`../security/sensitive-information-disclosure.md`](../security/sensitive-information-disclosure.md) | What must never be rendered or logged. |
| [`../security/exceptional-conditions.md`](../security/exceptional-conditions.md) | Error rendering without leaking detail. |
| [`../security/supply-chain.md`](../security/supply-chain.md) | Dependency policy for a browser bundle. |
| [`../security/security-misconfiguration.md`](../security/security-misconfiguration.md) | Build output and serving headers. |
