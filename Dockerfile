FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:./../data/build.db
ENV APP_PUBLIC_URL=http://localhost:4317
ENV APP_PORT=4317
ENV AVITO_API_BASE_URL=https://api.avito.ru
ENV AVITO_REDIRECT_URL=http://localhost:4317/api/avito/oauth/callback
ENV AVITO_ACCOUNT_ID=self
ENV AVITO_CLIENT_ID=
ENV AVITO_CLIENT_SECRET=
ENV AVITO_REVIEWS_LIST_PATH=/ratings/v1/reviews
ENV AVITO_REVIEW_DETAIL_PATH=/ratings/v1/reviews/{reviewId}
ENV AVITO_REVIEW_REPLY_PATH=/ratings/v1/reviews/{reviewId}/reply
ENV AVITO_ONLINE_PRESENCE_PATH=/messenger/v1/accounts/{accountId}/online
ENV AVITO_AUTOLOAD_PROFILE_PATH=/autoload/v2/profile
ENV AVITO_AUTOLOAD_UPLOAD_PATH=/autoload/v1/upload
ENV AVITO_AUTOLOAD_REPORTS_PATH=/autoload/v2/reports
ENV AVITO_AUTOLOAD_REPORT_PATH=/autoload/v3/reports/{reportId}
ENV AVITO_AUTOLOAD_LAST_REPORT_PATH=/autoload/v3/reports/last_completed_report
ENV AVITO_AUTOLOAD_REPORT_ITEMS_PATH=/autoload/v2/reports/{reportId}/items
ENV AVITO_MESSENGER_CHATS_PATH=/messenger/v2/accounts/{accountId}/chats
ENV AVITO_MESSENGER_MESSAGES_PATH=/messenger/v3/accounts/{accountId}/chats/{chatId}/messages
ENV AVITO_MESSENGER_SEND_PATH=/messenger/v1/accounts/{accountId}/chats/{chatId}/messages
ENV AVITO_WORKER_ONLINE_INTERVAL_SECONDS=45
ENV AVITO_WORKER_REVIEWS_INTERVAL_SECONDS=180
ENV AVITO_WORKER_MESSAGES_INTERVAL_SECONDS=45
ENV AVITO_WORKER_REPORTS_INTERVAL_SECONDS=300
ENV AVITO_ORDERS_LIST_PATH=/order-management/1/orders
ENV AVITO_ORDER_DETAIL_PATH=/order-management/1/orders/{orderId}
ENV AVITO_WORKER_ORDERS_INTERVAL_SECONDS=120
ENV SETTINGS_ENCRYPTION_KEY=docker-build-placeholder
ENV OPENAI_API_KEY=
ENV OPENAI_MODEL=gpt-4.1-mini
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && mkdir -p /app/data/uploads \
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
