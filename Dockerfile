# Build stage — NestJS compiles to /app/dist
FROM node:22.5-alpine AS builder

ARG GITHUB_PAT

WORKDIR /app

# Auth for @industronics/* private packages on GitHub Packages.
RUN echo "//npm.pkg.github.com/:_authToken=${GITHUB_PAT}" > ~/.npmrc

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev && rm -f ~/.npmrc

# Production stage — slim runtime image
FROM node:22.5-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "dist/main"]
