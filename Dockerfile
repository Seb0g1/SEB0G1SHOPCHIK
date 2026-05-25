FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:./../data/build.db
ENV APP_PUBLIC_URL=http://localhost:4317
ENV APP_PORT=4317
ENV AVITO_API_BASE_URL=https://api.avito.ru
ENV AVITO_REDIRECT_URL=http://localhost:4317/api/avito/oauth/callback
ENV SETTINGS_ENCRYPTION_KEY=docker-build-placeholder
ENV OPENAI_API_KEY=
ENV OPENAI_MODEL=gpt-4.1-mini
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4317
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
RUN mkdir -p /app/data/uploads
EXPOSE 4317
CMD ["npm", "run", "start"]
