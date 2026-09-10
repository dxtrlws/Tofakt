FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG WATCHLOG_BUILD=dev
ENV WATCHLOG_BUILD=$WATCHLOG_BUILD
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_PATH=/tmp/watchlog-build.db
RUN npm run build

FROM node:22-alpine AS runner

ARG WATCHLOG_BUILD=dev
ENV WATCHLOG_BUILD=$WATCHLOG_BUILD

LABEL org.opencontainers.image.title="Watchlog" \
  org.opencontainers.image.description="Records plays from tofa, syncs them to Trakt, and builds monthly and yearly reviews." \
  org.opencontainers.image.url="https://github.com/dxtrlws/Tofakt-" \
  org.opencontainers.image.documentation="https://github.com/dxtrlws/Tofakt-/tree/main/docs/package" \
  org.opencontainers.image.source="https://github.com/dxtrlws/Tofakt-/tree/main/docs/package" \
  org.opencontainers.image.revision="${WATCHLOG_BUILD}"

# node:alpine already provides uid/gid 1000 as "node". The entrypoint
# drops to PUID/PGID (default 1000); do not recreate that id here.
RUN apk add --no-cache tini su-exec libc6-compat

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=9477
ENV HOSTNAME=0.0.0.0
ENV DATABASE_PATH=/data/watchlog.db
ENV TZ=UTC

COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && rm -rf /app/data \
  && mkdir -p /data \
  && chown -R node:node /app /data

EXPOSE 9477
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||9477)+'/api/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
