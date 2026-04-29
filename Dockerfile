FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/backend/data

ENV NODE_ENV=production
ENV PORT=6666
ENV DB_PATH=/app/backend/data/visits.db

EXPOSE 6666

CMD ["node", "--experimental-sqlite", "backend/index.js"]
