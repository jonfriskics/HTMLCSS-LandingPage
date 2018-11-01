FROM node:10.1-alpine

ENV APP_DIR /src/app/

RUN mkdir -p $APP_DIR

COPY ./package-prod.json ${APP_DIR}/package.json

WORKDIR $APP_DIR

RUN ["npm", "install"]

COPY . .