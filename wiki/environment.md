# Environment

There is deliberately no `.env.example` file in this repository; this document is
the single source of truth for configuration.

## The one rule that governs everything here

**Nothing secret may be configured in this application.** A browser bundle is
public: every value Vite inlines at build time is readable by anyone who opens
the network tab. An API key, a database password or a signing secret placed in a
`VITE_` variable is a published secret, not a configured one.

Every setting below is a public value. Credentials belong to the server, and
provider API keys are entered per project through the interface and stored
encrypted there.

## Running with no configuration

No variables are required. The dev server proxies `/api` to
`http://localhost:4000`, and the production build calls `/api/v1` on whatever
origin serves it.

```bash
npm install
npm run dev
npm test
npm run build
```

## Development

```bash
# Nothing here is required; each line shows the default that applies when unset.

# Where the dev server forwards /api during development.
VITE_API_PROXY_TARGET=http://localhost:4000

# The base path the application calls at runtime. A relative path means the
# client calls whatever origin served it, which is why no cross origin
# configuration is needed in the default setup.
VITE_API_BASE_URL=/api/v1
```

## Build

`VITE_API_BASE_URL` is read at **build time** and inlined into the bundle.
Changing it requires a rebuild; setting it in the runtime container has no
effect.

```bash
VITE_API_BASE_URL=/api/v1 npm run build
```

Point it at an absolute URL only when the API is served from a different origin
than the bundle:

```bash
VITE_API_BASE_URL=https://your_api_host/api/v1 npm run build
```

That origin must then appear in the server's `CORS_ORIGINS` allowlist. Serving
both from one origin, as the bundled nginx configuration does, avoids that
entirely.

## Which variable applies when

The three variables belong to three different moments, and setting one in the
wrong place does nothing at all. This is worth reading before configuring a
deployment, because a variable that has no effect fails silently.

| Moment | Variable | Read by |
|---|---|---|
| `npm run dev` | `VITE_API_PROXY_TARGET` | The Vite dev server, in `vite.config.js`. |
| `npm run build` | `VITE_API_BASE_URL` | Vite, inlined into the bundle. |
| Container start up | `API_UPSTREAM` | nginx, through the rendered template. |

`VITE_API_PROXY_TARGET` has **no effect on a deployed container**. The production
image serves a built bundle from nginx and never runs the Vite dev server, so
the value is not read. Point the deployed proxy with `API_UPSTREAM` instead.

`VITE_API_BASE_URL` is consumed while the bundle is being built, so it has to
reach the build rather than the running container. In Docker that means the
`--build-arg` shown under [Build](#build); setting it as a runtime variable
leaves the built in default in place.

`API_UPSTREAM` is the only one of the three a running container reads.

## How the deployed proxy is configured

The image ships `nginx.conf.template`, and the nginx entrypoint renders it into
`/etc/nginx/conf.d/` at start up with `API_UPSTREAM` substituted. Nothing needs
rebuilding to point the client at a different backend.

```bash
# Backend on the same Compose network, the default.
API_UPSTREAM=http://server:4000

# Backend on a separate host, reached over TLS.
API_UPSTREAM=https://your_api_host
```

Scheme and host only. A trailing slash or a path turns the value into a
replacement for the matched `/api/` prefix and rewrites every proxied request,
so `https://your_api_host/` is not the same as `https://your_api_host`.

The address is resolved per request rather than once at start up. An unreachable
backend therefore returns 502 on `/api/` while the static site keeps serving,
instead of stopping nginx from booting, and a backend that changes address is
picked up without a restart.

Resolving per request means nginx needs a nameserver named in the configuration.
The image takes it from the container's own `/etc/resolv.conf`, which the
entrypoint exposes only when `NGINX_ENTRYPOINT_LOCAL_RESOLVERS` is set. The
Dockerfile sets it, and a deployment does not need to: it is noted here because
unsetting it leaves nginx unable to start.

Requests leave with the `Host` header naming `API_UPSTREAM`, which is what lets
a platform that routes by hostname deliver them, and with the browser's own host
in `X-Forwarded-Host`.

## Variable reference

`Required` answers whether the application fails without the variable. Every row
is `no`, which is the point of the defaults: the client runs, builds and tests
unconfigured. A `no` still leaves a value that must be correct for a deployment
serving the API from another origin.

| Variable | Required | Stage | Default | Purpose |
|---|---|---|---|---|
| `VITE_API_PROXY_TARGET` | no | dev server | `http://localhost:4000` | Backend the dev server proxies `/api` to. |
| `VITE_API_BASE_URL` | no | build | `/api/v1` | Base path the built bundle calls. |
| `API_UPSTREAM` | no | runtime | `http://server:4000` | Backend the nginx `/api/` block proxies to. Scheme and host, no path and no trailing slash. |

## Docker

```bash
docker build -t lxtranslator_client .

# Serves on 8080 and proxies /api to a backend named `server` on the same
# network.
docker run --rm -p 8080:8080 lxtranslator_client

# Proxying to a backend somewhere else. No rebuild: the bundle still calls
# /api/v1 on its own origin, and nginx forwards from there.
docker run --rm -p 8080:8080 \
  -e API_UPSTREAM=https://your_api_host \
  lxtranslator_client

# Calling a separate API origin from the browser directly, bypassing the proxy.
# This one is a build argument, and the API origin must then appear in the
# server's CORS_ORIGINS allowlist.
docker build -t lxtranslator_client \
  --build-arg VITE_API_BASE_URL=https://your_api_host/api/v1 .
```

## Docker Compose

The full application, client and server together. The client proxies `/api` to
the server, so the browser only ever talks to one origin.

```yaml
services:
  database:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: lxtranslator
      POSTGRES_USER: lxtranslator
      POSTGRES_PASSWORD: ${PG_PASSWORD:?set PG_PASSWORD in the shell environment}
    volumes:
      - database_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lxtranslator"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  server:
    image: your_registry/lxtranslator_server:your_tag
    depends_on:
      database:
        condition: service_healthy
    environment:
      PROD: "true"
      PG_HOST: database
      PG_PORT: "5432"
      PG_DATABASE: lxtranslator
      PG_USER: lxtranslator
      PG_PASSWORD: ${PG_PASSWORD:?set PG_PASSWORD in the shell environment}
      PG_SSL: "false"
      JWT_SECRET: ${JWT_SECRET:?set JWT_SECRET in the shell environment}
      ENCRYPTION_PASSPHRASE: ${ENCRYPTION_PASSPHRASE:?set ENCRYPTION_PASSPHRASE in the shell environment}
      TRUST_PROXY: "true"
      CLIENT_URL: https://your_client_host
      CORS_ORIGINS: https://your_client_host
    volumes:
      - upload_storage:/app/storage
    restart: unless-stopped

  client:
    build: .
    depends_on:
      - server
    environment:
      # The image default already points here; named for the sake of being
      # explicit about where /api goes.
      API_UPSTREAM: http://server:4000
    ports:
      - "8080:8080"
    restart: unless-stopped

volumes:
  database_data:
  upload_storage:
```

Secrets are interpolated from the shell rather than written into the file, and
the `:?` form makes Compose refuse to start when one is missing. Note that the
client service declares no secrets at all, which is the point.

## Kubernetes

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: lxtranslator-client-config
data:
  # Public values only. There is no Secret for this workload, by design.
  API_UPSTREAM: http://lxtranslator-server
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: lxtranslator-client
spec:
  replicas: 2
  selector:
    matchLabels:
      app: lxtranslator-client
  template:
    metadata:
      labels:
        app: lxtranslator-client
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
        fsGroup: 101
      containers:
        - name: client
          image: your_registry/lxtranslator_client:your_tag
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: lxtranslator-client-config
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: false
            capabilities:
              drop: ["ALL"]
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 300m
              memory: 128Mi
          livenessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 3
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: lxtranslator-client
spec:
  selector:
    app: lxtranslator-client
  ports:
    - port: 80
      targetPort: 8080
```

`readOnlyRootFilesystem` is left off because nginx writes its pid file and
temporary caches. Mount `emptyDir` volumes over `/var/cache/nginx` and
`/var/run` to enable it.

## Deployment checklist

- [ ] `npm run build` produces `dist/` with no warnings
- [ ] `VITE_API_BASE_URL` matches how the API is actually reachable
- [ ] If the API is on another origin, it appears in the server's `CORS_ORIGINS`
- [ ] TLS terminated in front of the client, and the server's `TRUST_PROXY=true`
- [ ] `npm audit` reports no high severity findings
- [ ] No `VITE_` variable holds anything that is not already public
