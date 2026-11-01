FROM node:24-slim AS build
WORKDIR /repo
RUN npm install --global pnpm@12.9.1
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter @repo/functions... \
 && pnpm --filter @repo/functions build \
 && pnpm --filter @repo/functions deploy --prod /out
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 FIELD_DATABASE=/data/fields.sqlite
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/fieldServer.js"]
