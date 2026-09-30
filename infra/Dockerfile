FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY apps ./apps
COPY packages ./packages
COPY infra ./infra
COPY tsconfig.json ./
RUN npm ci
