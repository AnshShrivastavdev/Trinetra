# Stage 1: Build production assets
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies cleanly
COPY package*.json ./
RUN npm ci

# Copy project files and build Vite bundle
COPY . .
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=${VITE_API_URL:-}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL:-}

RUN npm run build

# Stage 2: Serve with lightweight Nginx alpine
FROM nginx:alpine-slim

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built static files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
