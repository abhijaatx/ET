FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/
RUN npm install --workspaces --if-present
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG INTERNAL_API_URL=http://api:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
RUN npm run build --workspace=apps/web
CMD ["node", "apps/web/.next/standalone/server.js"]
