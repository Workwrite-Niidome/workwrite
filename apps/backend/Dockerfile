FROM node:22-alpine AS base
RUN apk add --no-cache openssl

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json turbo.json ./

# Copy package manifests
COPY packages/shared/package.json packages/shared/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY apps/backend/package.json apps/backend/

# Install dependencies
RUN npm ci

# Copy source
COPY packages/ packages/
COPY apps/backend/ apps/backend/

# Generate Prisma client
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma

# Build
RUN npx turbo build --filter=@workwrite/backend

# Production stage
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl

WORKDIR /app

COPY --from=base /app/package.json ./package.json
COPY --from=base /app/package-lock.json ./package-lock.json
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=base /app/apps/backend/dist ./apps/backend/dist
COPY --from=base /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=base /app/apps/backend/package.json ./apps/backend/package.json

WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma && node prisma/ensure-schema.js && (npx prisma db seed || true) && node dist/main"]
