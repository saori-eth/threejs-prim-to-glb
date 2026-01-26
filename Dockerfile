FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY src/client/package.json ./src/client/
COPY src/server/package.json ./src/server/

RUN npm install

COPY . .

RUN npm run build

WORKDIR /app/src/server

EXPOSE 8080

CMD ["node", "api.js"]
