FROM alpine:latest

RUN apk add --update nodejs
RUN apk add --update npm

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

CMD [ "npm", "start" ]