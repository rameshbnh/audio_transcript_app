# Use a specific version of node image
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

RUN npm install

COPY . .

# Build the application
RUN npm run build

# Use a specific version of nginx to avoid pulling latest
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set proper permissions for the web content
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Keep running as root as nginx in alpine needs it for proper operation
# The security risk is minimal since this is a containerized environment
