FROM node:24-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN pnpm --filter @sms/shared build && pnpm --filter api build
RUN pnpm deploy --filter api --prod /prod/api

FROM node:24-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /prod/api ./

EXPOSE 8080

CMD ["node", "dist/main.js"]
