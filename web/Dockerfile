# Build context must be the repo root (not web/) so that src/ is available.
# Build with: docker build -f web/Dockerfile .

FROM node:20-alpine AS development-dependencies-env
COPY web/package.json web/package-lock.json /app/
WORKDIR /app
RUN npm ci

FROM node:20-alpine AS production-dependencies-env
COPY web/package.json web/package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine AS build-env
# Copy the web app
COPY web/ /app/
# Copy src/ so regenerate.server.ts can import from ../../../src/
COPY src/ /src/
COPY package.json /package.json
COPY --from=development-dependencies-env /app/node_modules /app/node_modules
WORKDIR /app
RUN npm run build

FROM node:20-alpine
COPY web/package.json web/package-lock.json /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
# src/ is needed at runtime for dynamic imports in regenerate.server.ts
COPY src/ /src/
COPY package.json /package.json
WORKDIR /app
CMD ["npm", "run", "start"]
