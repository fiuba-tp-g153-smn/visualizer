FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Development stage
FROM base AS development
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0", "--port", "3000"]

# Build stage
# FROM base AS build
# RUN npm run build

# # Production stage
# FROM nginx:alpine AS production
# COPY --from=build /app/build /usr/share/nginx/html
# EXPOSE 80
# CMD ["nginx", "-g", "daemon off;"]
