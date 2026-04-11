FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV WACHA_DB_PATH=/data/wacha.db

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run prestart

EXPOSE 3000

CMD ["node", "--import", "tsx", "src/server.ts"]
