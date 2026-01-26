# Build Stage
FROM node:20 as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage
FROM node:20-slim
WORKDIR /app
COPY --from=build-stage /app/dist ./dist
COPY package*.json ./
RUN npm install --only=production
COPY server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
