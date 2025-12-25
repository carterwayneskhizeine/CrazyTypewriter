# Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first to leverage cache
COPY package.json package-lock.json* ./

RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Production Stage
FROM nginx:alpine

# Copy the build artifacts from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration template
COPY nginx/default.conf /etc/nginx/conf.d/default.conf.template

# Create entrypoint script directly to avoid Windows line ending issues
RUN printf '#!/bin/sh\n\nif [ -n "$POST_HOST" ]; then\n    post_host=$(echo "$POST_HOST" | sed -e "s|^[^/]*//||" -e "s|/.*||")\nfi\n\nsed -e "s|__POST_HOST__|$POST_HOST|g" -e "s|__POST_HOST_NAME__|$post_host|g" /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf\n\nexec nginx -g "daemon off;"\n' > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
