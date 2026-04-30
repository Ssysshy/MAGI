FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @magi/shared build
RUN pnpm --filter @magi/backend build
EXPOSE 3001
CMD ["pnpm", "--filter", "@magi/backend", "start"]
