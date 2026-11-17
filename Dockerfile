# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node src/domain/aiValidation.js ./src/domain/aiValidation.js
COPY --chown=node:node scripts/notifications-once.mjs ./scripts/notifications-once.mjs
USER node
EXPOSE 8080
CMD ["node", "server/index.mjs"]
