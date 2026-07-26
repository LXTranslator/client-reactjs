---
name: Security Misconfiguration
description: Build output and serving configuration for the LXTranslator client.
---

# Security Misconfiguration

## Serving headers

`nginx.conf.template` sets these on every response:

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'` and per directive restrictions | The layered defence behind React's escaping. |
| `X-Content-Type-Options` | `nosniff` | Stops a response being reinterpreted as script. |
| `X-Frame-Options` | `DENY` | Clickjacking. |
| `Content-Security-Policy: frame-ancestors 'none'` | The modern equivalent, set alongside. |
| `Referrer-Policy` | `no-referrer` | URLs never leak to third parties. |
| `Permissions-Policy` | camera, microphone, geolocation and payment disabled | The application needs none of them. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates the browsing context. |
| `X-Robots-Tag` | `noindex, nofollow` | Keeps confidential material out of search. |

`server_tokens off` stops the server advertising its version.

### About the policy

`script-src 'self'` with no `'unsafe-inline'`: Vite emits an external bundle, so
no inline script allowance is needed. **Do not add one.**

`style-src` does permit `'unsafe-inline'`, because a few components set layout
values through the `style` attribute. That is a real, if small, loosening. Never
interpolate user content into a style attribute; `xss.md` covers why.

`connect-src 'self'` works because the API is proxied through the same origin.
Building against a separate API origin requires adding that origin here.

## Build output

* **Source maps are disabled** in production, so the original sources are not
  published with the bundle.
* **Hashed asset filenames** are cached for a year and marked immutable, since
  their contents cannot change.
* **`index.html` is never cached**, or a deploy would leave browsers loading an
  old shell referencing assets that no longer exist.

## Container

* Multi stage: the runtime layer carries nginx and static files only. No Node
  runtime, no source, no build toolchain.
* Runs as the unprivileged `nginx` user, listening on 8080 rather than 80 so no
  privileged port bind is needed.
* `.dockerignore` keeps `.env`, tests, git metadata and documentation out of the
  build context.

## Single origin

The dev server proxies `/api`, and the production nginx configuration does the
same. One origin means no cross origin preflight, no need to relax the backend's
origin allowlist, and no `credentials: 'include'` anywhere.

Serving the API from a different origin is supported, but it means adding that
origin to `connect-src` here and to `CORS_ORIGINS` on the server. Prefer one
origin.

## Checklist before deploying

- [ ] `npm run build` is clean
- [ ] `npm audit` reports no high severity findings
- [ ] `VITE_API_BASE_URL` matches how the API is actually reachable
- [ ] No `VITE_` variable holds anything not already public
- [ ] TLS terminated in front of the client
- [ ] If the API is on another origin, `connect-src` and `CORS_ORIGINS` both
      updated
