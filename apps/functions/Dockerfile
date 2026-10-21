# CropWatch API (Hono: /trpc + /api/v1) for Cloud Run.
# Build from the repo root, since the server bundles workspace packages:
#   docker build -f apps/functions/Dockerfile -t cropwatch-api .

FROM node:24-slim AS build
WORKDIR /repo
RUN npm install --global pnpm@12.9.1

# Fetch dependencies from the lockfile alone, so this layer survives source edits.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --offline --frozen-lockfile --filter @repo/functions... \
 && pnpm --filter @repo/functions build

# The server is a single esbuild bundle with no runtime node_modules.
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    NO_COLOR=1
COPY --from=build /repo/apps/functions/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/server.js"]
