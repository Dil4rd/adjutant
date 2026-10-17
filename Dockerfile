# syntax=docker/dockerfile:1

# 1) Build the single self-contained dist/index.html in a clean, pinned env.
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Export-only stage. Pull just the built file out to the host:
#    docker build --target artifact -o dist .
#    -> writes ./dist/index.html (nothing else, no node, no layers).
FROM scratch AS artifact
COPY --from=builder /app/dist/index.html /index.html

# 3) Static server for local/prod. http://localhost:<port> is a WebAuthn
#    secure context, so the served container is fully usable for dev/testing:
#    docker build --target serve -t adjutant . && docker run -p 8080:80 adjutant
FROM nginx:1.27-alpine AS serve
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
