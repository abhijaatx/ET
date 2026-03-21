FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY packages/db/package.json packages/db/package.json

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "apps/api"]
