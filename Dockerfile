# syntax=docker/dockerfile:1

# LXTranslator client image.
#
# Two stages: build the bundle with Node, then serve the static output from
# nginx. The runtime layer carries no Node runtime, no source and no build
# toolchain, which keeps the published image small and its attack surface
# limited to a static file server.
#
# The bundle is public by definition, so nothing secret may be baked into it.
# See wiki/environment.md.

FROM node:22-bookworm-slim AS build

WORKDIR /app

# Copied on their own so the dependency layer is reused whenever only source
# files change.
COPY package.json package-lock.json ./

# `npm ci` installs exactly what the lockfile pins, which is what makes the
# build reproducible. Install scripts are disabled so a compromised package
# cannot execute code during the build.
RUN npm ci --ignore-scripts

COPY index.html vite.config.js ./
COPY src ./src

# The API base path is baked in at build time. It defaults to a relative path so
# the client calls whatever origin serves it, which is what the nginx proxy
# below arranges.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build


FROM nginx:1.27-alpine AS runtime

# Drop the packaged default site so only our configuration is served.
RUN rm -f /etc/nginx/conf.d/default.conf

# Templates are rendered into conf.d by the image's entrypoint at start up,
# which is what turns the backend address into a deploy time setting.
COPY nginx.conf.template /etc/nginx/templates/lxtranslator.conf.template

# Backend the /api/ block forwards to: scheme and host, no path and no trailing
# slash. The default matches the service name used in the Compose example; a
# deployment whose backend lives elsewhere overrides it.
ENV API_UPSTREAM=http://server:4000

# Restrict substitution to the two variables the template actually uses.
# Unfiltered, the entrypoint substitutes every environment variable it can see,
# so an unrelated variable sharing a name with an nginx variable would rewrite
# the configuration.
ENV NGINX_ENVSUBST_FILTER='^(API_UPSTREAM|NGINX_LOCAL_RESOLVERS)$'

# The entrypoint reads the container's nameservers into NGINX_LOCAL_RESOLVERS
# for the template's resolver directive, but only when this is set: its script
# returns immediately otherwise, leaving the placeholder unsubstituted and nginx
# refusing to start on a resolver it cannot resolve. Removing this breaks the
# image.
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

# Fallback for the same variable, used only if the entrypoint script that
# normally overwrites it is ever absent. It keeps a missing value from reaching
# nginx as an unsubstituted placeholder; 127.0.0.11 is the embedded DNS server
# that resolves service names on a Compose network.
ENV NGINX_LOCAL_RESOLVERS=127.0.0.11

COPY --from=build /app/dist /usr/share/nginx/html

# nginx needs to write its pid and caches, so those paths are handed to the
# unprivileged user rather than running the server as root. conf.d is included
# because the entrypoint writes the rendered template there before nginx starts.
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /etc/nginx/conf.d \
  && touch /var/run/nginx.pid \
  && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
