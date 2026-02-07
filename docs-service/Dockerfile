# syntax=docker/dockerfile:1

################################
# Stage 1: Builder
################################
FROM node:22-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy source code
COPY . .

# Build the application with cache mount for Docusaurus
RUN --mount=type=cache,target=/app/.docusaurus \
    npm run build

################################
# Stage 2: Runtime
################################
FROM nginx:mainline-alpine-slim AS runner

# Copy built application from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=10s --timeout=10s --retries=5 CMD nc -z localhost 80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
