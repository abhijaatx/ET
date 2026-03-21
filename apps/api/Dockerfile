FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/
RUN npm install --workspaces --if-present
COPY . .
RUN npm run build --workspace=apps/api
CMD ["node", "apps/api/dist/index.js"]
