FROM node:12-alpine

COPY index.js .
COPY package.json .

RUN npm i --no-dev

EXPOSE 80

CMD ["node", "index.js"]
