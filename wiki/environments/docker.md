# Docker

The image is built in two stages: Node builds the bundle, then nginx serves the static
output. The runtime layer carries no Node runtime, no source and no build toolchain, which
keeps the published image small and its attack surface limited to a static file server.

## Building

```bash
docker build -t lxtranslator-client .
```

The API base path is baked in at build time and defaults to `/api/v1`, a relative path, so
the client calls whatever origin serves it. Override it only if the API lives on a
different origin:

```bash
docker build --build-arg VITE_API_BASE_URL=https://api.example.com/v1 -t lxtranslator-client .
```

Because the bundle is public, that value is public too. Nothing secret may be passed as a
build argument — see [`env.md`](env.md).

Dependencies are installed with `npm ci --ignore-scripts`: the lockfile is what makes the
build reproducible, and disabling install scripts stops a compromised package executing
code during the build.

## Running

```bash
docker run -p 8080:8080 -e API_UPSTREAM=http://server:4000 lxtranslator-client
```

The container listens on **8080**, not 80, so nginx can run as an unprivileged user. It
runs as the `nginx` user and declares a healthcheck that polls its own root path.

## Configuration at start up

`nginx.conf.template` is a template, not a finished configuration. The nginx entrypoint
renders everything in `/etc/nginx/templates` into `/etc/nginx/conf.d` at start up. Three
environment variables govern that:

| Variable | Default | Purpose |
|---|---|---|
| `API_UPSTREAM` | `http://server:4000` | Backend the `/api/` block forwards to: scheme and host, no path, no trailing slash. |
| `NGINX_ENVSUBST_FILTER` | `^(API_UPSTREAM\|NGINX_LOCAL_RESOLVERS)$` | Restricts substitution to the two variables the template uses. |
| `NGINX_LOCAL_RESOLVERS` | `127.0.0.11` | Nameserver for per request upstream resolution. |

Two of those are load bearing in ways that are easy to undo:

* **The substitution filter is not optional.** Unfiltered, the entrypoint substitutes
  every environment variable it can see, so an unrelated variable sharing a name with an
  nginx variable would rewrite the configuration.
* **`NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1` must stay set.** The entrypoint script that fills
  `NGINX_LOCAL_RESOLVERS` from the container's `/etc/resolv.conf` returns immediately
  unless it is, leaving the placeholder unsubstituted and nginx refusing to start.

## What the served configuration does

* **Serves the single page application.** Any unmatched path falls through to
  `index.html`, so a deep link loads the application rather than returning 404.
* **Proxies `/api/`** to `API_UPSTREAM`, so the browser sees one origin — no preflight, and
  no need to relax the backend's origin allowlist. The address is held in an nginx
  variable so it resolves per request: an unreachable backend becomes a 502 on `/api/`
  instead of stopping the whole server from booting.
* **Sets security headers** on every response, including a content security policy that
  limits scripts and styles to this origin, forbids framing, and restricts connections to
  this origin because the API is proxied through it.
* **Caches hashed assets for a year** and never caches `index.html`, so a deploy cannot
  leave a browser loading an old shell that references assets which no longer exist.
* **Keeps the application out of search indexes** with `X-Robots-Tag`.

Uploads are limited to 4 MB with a 120 second read timeout on `/api/`, which is generous
because accepting a translation upload can take a while; processing itself is asynchronous
and polled.
