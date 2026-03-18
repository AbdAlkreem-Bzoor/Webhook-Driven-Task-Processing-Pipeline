FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./

RUN npm run build

EXPOSE 3000
EXPOSE 9464

CMD ["node", "dist/main.js"]
