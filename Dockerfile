# Use Node.js 18 Alpine as base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Accept build arguments
ARG DATA_SERVICE_URL

# Set the environment variable
ENV DATA_SERVICE_URL=$DATA_SERVICE_URL

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port 4000 (default for Angular SSR)
EXPOSE 4000

# Start the SSR server
CMD ["npm", "run", "serve:ssr:visualizator"]
