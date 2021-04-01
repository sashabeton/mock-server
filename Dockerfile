FROM node:12-alpine

COPY index.js .
COPY package.json .

RUN npm i --no-dev

EXPOSE 80 81

CMD ["node", "index.js"]
