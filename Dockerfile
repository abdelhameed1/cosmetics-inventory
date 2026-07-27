# syntax=docker/dockerfile:1

# ---- Builder: compiles the plugin admin/server bundles + the Strapi app ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src/plugins/inventory-dashboard/package.json src/plugins/inventory-dashboard/package-lock.json src/plugins/inventory-dashboard/
RUN npm ci --prefix src/plugins/inventory-dashboard

COPY . .

RUN npm run build --prefix src/plugins/inventory-dashboard

ENV NODE_ENV=production
RUN npm run build

# ---- Runtime: only the compiled output + production deps ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/config ./config
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.strapi ./.strapi
COPY --from=builder /app/src/plugins/inventory-dashboard/dist ./src/plugins/inventory-dashboard/dist
COPY --from=builder /app/src/plugins/inventory-dashboard/package.json ./src/plugins/inventory-dashboard/package.json
COPY public ./public

EXPOSE 1337
CMD ["npm", "run", "start"]
