# Stage 1: Build Frontend and Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and client package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd client && npm install

# Copy source code
COPY tsconfig.json ./
COPY server ./server
COPY client ./client

# Build client SPA and backend TypeScript
RUN cd client && npm run build
RUN npm run build:server

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled backend and frontend assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/client/dist ./dist/client/dist
COPY --from=builder /app/server/db/schema.sql ./dist/server/db/schema.sql

EXPOSE 3000

CMD ["node", "dist/server/index.js"]
