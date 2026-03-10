# syntax=docker/dockerfile:1

################################
# Stage 1: Builder
################################
FROM node:22-alpine AS build

# Set working directory
WORKDIR /app

# Build arguments for environment variables
ARG DATA_SERVICE_BASE_URL
ARG ALERTS_SERVICE_BASE_URL
ARG TILE_FORMAT
ARG APP_HOST_PORT
ARG DOCS_URL

# Set environment variables for build
ENV DATA_SERVICE_BASE_URL=$DATA_SERVICE_BASE_URL
ENV ALERTS_SERVICE_BASE_URL=$ALERTS_SERVICE_BASE_URL
ENV TILE_FORMAT=$TILE_FORMAT
ENV APP_HOST_PORT=$APP_HOST_PORT
ENV DOCS_URL=$DOCS_URL

# Copy package files
COPY package*.json ./

# Install dependencies with cache mount (persists npm cache between builds)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code
COPY . .

# Build the application (esbuild is fast, no cache needed)
RUN npm run build

################################
# Stage 2: Runtime
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
