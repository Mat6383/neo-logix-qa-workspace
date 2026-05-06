FROM node:22-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p data db logs

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "server.js"]
