FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/ ./packages/core/
COPY apps/server/ ./apps/server/

RUN npm ci

RUN mkdir -p logs

EXPOSE 3001

CMD ["node_modules/.bin/tsx", "--tsconfig", "apps/server/tsconfig.json", "apps/server/src/server.ts"]
