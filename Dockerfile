FROM node:18

WORKDIR /app

COPY . /app/

CMD ["node", "index.mjs"]
