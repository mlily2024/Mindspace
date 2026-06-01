# Mindspace backend — Node.js / Express API
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Run as the built-in non-root node user for security
USER node

# Backend listens on 5000 by default
EXPOSE 5000

# Lightweight container healthcheck against the API health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/server.js"]
