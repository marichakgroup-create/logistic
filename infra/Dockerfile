FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY infra ./infra
COPY tsconfig.json ./
RUN npm ci --include=dev && npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
