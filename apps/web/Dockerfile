FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json

RUN npm install

COPY . .

RUN npm run build --workspace apps/web

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "apps/web"]
