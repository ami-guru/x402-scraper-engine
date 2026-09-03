FROM node:20-alpine

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY . .
RUN npx tsc -p tsconfig.json

ENV NODE_ENV=production
ENV WORKER_URL=https://x402-scraper-engine.gejoe-tt.workers.dev

ENTRYPOINT ["node", "dist/client/mcp-server.js"]
