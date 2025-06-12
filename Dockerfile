FROM node:24-alpine3.20

WORKDIR /home/node/app

RUN apk add --no-cache python3  make g++

COPY . ./

RUN npm install

CMD [ "node", "./index.js" ]