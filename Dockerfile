FROM node:12-alpine

COPY src src
COPY package.json .

RUN npm i --no-dev

CMD ["node", "src/index.js"]
