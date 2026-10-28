# Phytos API (Hono: /trpc, /api/v1, /internal/events) for Cloud Run.
# Build from the repo root, since the server bundles workspace packages:
#   docker build -f apps/functions/Dockerfile -t cropwatch-api .
# infra/deploy.sh builds it with Cloud Build.

FROM node:24-slim AS build
WORKDIR /repo
RUN npm install --global pnpm@12.9.1

# Fetch dependencies from the lockfile alone, so this layer survives source edits.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
# deploy stays online: pnpm's supply-chain check needs registry metadata, not just tarballs.
RUN pnpm install --offline --frozen-lockfile --filter @repo/functions... \
 && pnpm --filter @repo/functions build \
 && pnpm --filter @repo/functions deploy --prod /out

# dist/server.js bundles the workspace code; third-party dependencies come from the production
# node_modules that `pnpm deploy` assembled. prompts/ sits beside dist/, where the server finds it.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    NO_COLOR=1
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY prompts ./prompts
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/server.js"]
