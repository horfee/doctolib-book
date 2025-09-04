FROM node:slim

WORKDIR /app
COPY index.js logging.ts package.json /app/
RUN npm install

ENTRYPOINT ["node","index.js"]

