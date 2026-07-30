FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copy only what we need
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Install shared dependencies and build
WORKDIR /app/packages/shared
RUN npm install
RUN npm run build

# Install API dependencies and build
WORKDIR /app/apps/api
RUN npm install
RUN npx prisma generate
RUN npm run build

# Runtime
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# Copy only production deps + built artifacts
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules

WORKDIR /app/apps/api
RUN mkdir -p uploads
EXPOSE ${PORT:-4000}
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
