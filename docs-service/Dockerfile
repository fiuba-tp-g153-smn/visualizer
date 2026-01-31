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

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS runner

# Copy built application from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=3s --timeout=10s --retries=3 CMD nc -z localhost 80 || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
