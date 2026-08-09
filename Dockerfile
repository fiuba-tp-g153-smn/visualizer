# syntax=docker/dockerfile:1

################################
# Stage 1: Documentation
################################
# Renders docs/ into a static site with MkDocs Material. Keep this image tag in
# sync with DOCS_IMAGE in the Makefile so a local `make docs` and the image
# build produce the same output. --strict fails the build on a broken link.
FROM squidfunk/mkdocs-material:9.7.7 AS docs

COPY mkdocs.yml /docs/mkdocs.yml
COPY docs /docs/docs

# Material ships source maps for its own bundle. A reader never fetches them,
# so they are 1.2 MB of the image nobody downloads. Local `make docs` keeps them.
RUN mkdocs build --strict -d /site \
    && find /site -name '*.map' -delete

################################
# Stage 2: Builder
################################
FROM node:24-alpine AS build

# Set working directory
WORKDIR /app

# Build arguments for environment variables
ARG DATA_SERVICE_BASE_URL
ARG ALERTS_SERVICE_BASE_URL
ARG SMN_API_PROMPT_FOR_TOKEN
ARG APP_HOST_PORT
ARG DOCS_URL
ARG METRICS_SERVICE_BASE_URL
ARG IGN_PLACE_SEARCH_URL
ARG NOMINATIM_SEARCH_URL

# Set environment variables for build
ENV DATA_SERVICE_BASE_URL=$DATA_SERVICE_BASE_URL
ENV ALERTS_SERVICE_BASE_URL=$ALERTS_SERVICE_BASE_URL
ENV SMN_API_PROMPT_FOR_TOKEN=$SMN_API_PROMPT_FOR_TOKEN
ENV APP_HOST_PORT=$APP_HOST_PORT
ENV DOCS_URL=$DOCS_URL
ENV METRICS_SERVICE_BASE_URL=$METRICS_SERVICE_BASE_URL
ENV IGN_PLACE_SEARCH_URL=$IGN_PLACE_SEARCH_URL
ENV NOMINATIM_SEARCH_URL=$NOMINATIM_SEARCH_URL

# Copy package files
COPY package*.json ./

# Install dependencies with cache mount (persists npm cache between builds)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code
COPY . .

# Drop the rendered docs into the app's static assets. Must land after
# `COPY . .` so it cannot be shadowed, and before the build so the
# `public/**/*` asset glob in angular.json picks it up.
COPY --from=docs /site ./public/docs-site

# Build the application with a persistent Angular build cache.
# This is the custom-webpack (Webpack) builder, which writes ~110MB to
# .angular/cache. Persisting that cache across deploys turns a cold ~120s
# production build into a warm ~40s one (~3x faster).
RUN --mount=type=cache,target=/app/.angular \
    npm run build

################################
# Stage 3: Runtime
################################
FROM nginx:mainline-alpine-slim AS runner

# Copy built application from build stage
COPY --from=build /app/dist/visualizer /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=10s --timeout=10s --retries=5 CMD nc -z localhost 80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
