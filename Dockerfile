# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies + express for serving
RUN npm ci --omit=dev && \
    npm install express

# Copy built assets from builder stage
COPY --from=builder /app/dist ./dist

# Copy server file
COPY server.js ./

# Environment variables must be provided at runtime
# PORT - The port to run the server on
# IMMICH_API_URL - The URL of the Immich API server

# Start the server
CMD ["node", "server.js"]
