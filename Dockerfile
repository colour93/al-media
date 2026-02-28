FROM oven/bun:1 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY web/app/package.json ./web/app/package.json
COPY web/admin/package.json ./web/admin/package.json
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build:all

FROM oven/bun:1
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=39994

COPY --from=build /app/dist ./dist
COPY --from=build /app/web/app/dist ./web/app/dist
COPY --from=build /app/web/admin/dist ./web/admin/dist

EXPOSE 39994
CMD ["bun", "run", "dist/index.js"]
