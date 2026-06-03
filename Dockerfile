# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    ASSET_LIBRARY_HOST=0.0.0.0 \
    ASSET_LIBRARY_PORT=3000 \
    ASSET_LIBRARY_DATA_DIR=/data/asset-library \
    ASSET_LIBRARY_STATIC_DIR=/app/dist

COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./

RUN mkdir -p /data/asset-library

EXPOSE 3000
VOLUME ["/data/asset-library"]

CMD ["npm", "run", "start"]
