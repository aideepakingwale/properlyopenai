# Zero-cost friendly single-image deploy (Render / Fly.io / Railway / local Docker)
FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
COPY server/package.json server/package-lock.json* ./server/
COPY client/package.json client/package-lock.json* ./client/
COPY shared ./shared

RUN npm install --prefix server \
  && npm install --prefix client

COPY server ./server
COPY client ./client

RUN npm run build --prefix client

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    SERVE_CLIENT=true \
    MOCK_MODE=true \
    CLIENT_ORIGIN=* \
    DB_PATH=data/properly.db \
    STORAGE_DIR=storage

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY shared ./shared
COPY server/package.json ./server/
COPY --from=build /app/server/node_modules ./server/node_modules
COPY server ./server
COPY --from=build /app/client/dist ./client/dist

RUN mkdir -p /app/server/data /app/server/storage \
  && chown -R node:node /app

USER node
EXPOSE 3001

WORKDIR /app/server
CMD ["node", "src/index.js"]
