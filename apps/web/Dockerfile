FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/
RUN npm install --workspaces --if-present
COPY . .
RUN npm run build --workspace=apps/web
CMD ["node", "apps/web/.next/standalone/server.js"]
