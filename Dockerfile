# Build stage
FROM node:26-alpine as build

# Add build argument for version
ARG VERSION=development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Replace version in config.ts
RUN sed -i "s/const VERSION = 'development'/const VERSION = '${VERSION}'/" config.ts

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration and entrypoint script
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/docker/entrypoint.sh /docker-entrypoint.sh

# Create required directories and set permissions
RUN mkdir -p /var/cache/nginx/client_temp \
    && mkdir -p /var/cache/nginx/proxy_temp \
    && mkdir -p /var/cache/nginx/fastcgi_temp \
    && mkdir -p /var/cache/nginx/uwsgi_temp \
    && mkdir -p /var/cache/nginx/scgi_temp \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && touch /var/run/nginx.pid \
    && chown -R nginx:nginx /var/run/nginx.pid \
    && chmod +x /docker-entrypoint.sh

# Switch to non-root user
USER nginx

# Expose port 80
EXPOSE 80

# Use the entrypoint script
ENTRYPOINT ["/docker-entrypoint.sh"] 