FROM oven/bun:1 AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ pkg-config libpq-dev ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./
COPY web/app/package.json ./web/app/package.json
COPY web/admin/package.json ./web/admin/package.json
RUN bun install --frozen-lockfile --ignore-scripts \
  && (cd web/app && bun install --frozen-lockfile) \
  && (cd web/admin && bun install --frozen-lockfile)

COPY . .
RUN bun run build:all

FROM oven/bun:1
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=39994

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates libpq5 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/web/app/dist ./web/app/dist
COPY --from=build /app/web/admin/dist ./web/admin/dist

EXPOSE 39994
CMD ["sh", "-c", "bun run dist/scripts/migrate.js && bun run dist/index.js"]
