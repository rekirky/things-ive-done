FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/visits.db

EXPOSE 3000

CMD ["node", "--experimental-sqlite", "index.js"]
