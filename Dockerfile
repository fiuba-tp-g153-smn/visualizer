# Build stage
FROM node:22-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build arguments for environment variables
ARG BACKEND_BASE_URL
ARG USE_MOCK_TILES
ARG TILE_FORMAT
ARG TILE_FORMAT
ARG APP_HOST_PORT
ARG DOCS_URL

# Set environment variables for build
ENV BACKEND_BASE_URL=$BACKEND_BASE_URL
ENV USE_MOCK_TILES=$USE_MOCK_TILES
ENV TILE_FORMAT=$TILE_FORMAT
ENV TILE_FORMAT=$TILE_FORMAT
ENV APP_HOST_PORT=$APP_HOST_PORT
ENV DOCS_URL=$DOCS_URL

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS runner

# Copy built application from build stage
COPY --from=build /app/dist/visualizator /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=2s --timeout=10s --retries=3 CMD nc -z localhost 80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
