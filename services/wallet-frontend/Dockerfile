# Stage 1: Build
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files from the service directory
COPY services/wallet-frontend/package.json services/wallet-frontend/package-lock.json ./services/wallet-frontend/

# Set working directory to the service folder
WORKDIR /app/services/wallet-frontend

# Install dependencies
RUN npm ci

# Copy the rest of the service source code
COPY services/wallet-frontend/ ./

# Copy libs directory for tests that depend on it
COPY libs/ /app/libs/

# Build the app (mode can be passed as a build arg, defaults to production)
ARG MODE=production
RUN npx vite build --mode $MODE

# Stage 2: Development (Vite Dev Server)
FROM builder AS development
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# Stage 3: Test
FROM builder AS test
RUN npm run test

# Stage 4: Serve
FROM nginx:alpine AS production

# Ensure tests passed by copying a file from the test stage
COPY --from=test /app/services/wallet-frontend/package.json /dev/null

# Copy the custom nginx config template
COPY services/wallet-frontend/nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy the built static files from the builder stage
COPY --from=builder /app/services/wallet-frontend/dist /usr/share/nginx/html

# Expose port 8080
EXPOSE 8080

# Configure Nginx to run as non-root
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d /usr/share/nginx/html

USER nginx

# Use envsubst to replace variables and start nginx
# We explicitly list variables to replace to avoid breaking Nginx internal variables like $host
CMD ["/bin/sh", "-c", "envsubst '$AUTH_PROXY_URL $API_PROXY_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && cat /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
