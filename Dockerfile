FROM node:24-alpine3.20

WORKDIR /home/node/app

COPY . ./

RUN npm install

CMD [ "node", "./index.js" ]