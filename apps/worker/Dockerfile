# Standalone iiko sync worker — build context = apps/worker
FROM node:22-slim

WORKDIR /app

# Install dependencies (supabase-js, zod, tsx)
COPY package.json ./
RUN npm install --no-audit --no-fund

# App sources
COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production
ENV TZ=Europe/Moscow

# Runs reference sync every 6h and live iiko sync (cash shifts + OLAP) every 5m
CMD ["npx", "tsx", "src/index.ts"]
