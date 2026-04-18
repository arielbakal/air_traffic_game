FROM node:20-alpine AS builder

ARG VITE_SERVER_URL=""
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/core/ ./packages/core/
COPY apps/server/ ./apps/server/
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts postcss.config.js tailwind.config.js ./
COPY index.html ./
COPY src/ ./src/
COPY public/ ./public/

RUN npm ci
RUN npm run build

FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
