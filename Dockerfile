# Divya Yatra — production image (Railway or any Docker host).
# Build stage: install, fetch the CC0 Poly Haven assets (textures converted to WebP), build with Vite.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY scripts ./scripts
RUN npm ci
COPY . .
RUN npm run assets && npm run build
# pre-compress text-like files so the server can send gzip without spending CPU per request
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.hdr' -o -name '*.svg' \) \
    -exec gzip -k -9 {} \;

# Serve stage: a tiny static server; Railway provides $PORT.
FROM node:22-slim
WORKDIR /app
RUN npm install -g sirv-cli@3
COPY --from=build /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "sirv dist --host 0.0.0.0 --port ${PORT} --gzip --maxage 86400"]
