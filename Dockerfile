FROM node:22-bookworm-slim

WORKDIR /app

ENV PORT=51743
ENV WACHA_DB_PATH=/data/wacha.db

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production

EXPOSE 51743

CMD ["node", "--import", "tsx", "src/server.ts"]
