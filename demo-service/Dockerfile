FROM node
MAINTAINER Julius Ecker <jecker@msa.com>

WORKDIR /app
COPY src src
COPY package.json package.json

RUN npm install
RUN npm test

CMD npm start