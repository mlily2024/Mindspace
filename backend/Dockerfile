# Mindspace backend — Node.js / Express API
FROM node:20-alpine

# Install psql for the bootstrap script (free-tier Render path). psql is the
# canonical way to apply multi-statement SQL files with dollar-quoted function
# bodies — Node's pg client.query() chokes on those in concatenated SQL.
# Alpine package adds ~12 MB; runs as root before the USER switch below.
RUN apk add --no-cache postgresql-client

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

# Auto-bootstrap on every startup (idempotent — CREATE TABLE IF NOT EXISTS
# throughout) when AUTO_MIGRATE=true. Required on Render free tier where
# `preDeployCommand` and Shell access aren't available, so this is the only
# path to apply migrations. Falls through harmlessly when AUTO_MIGRATE is
# unset — local Docker Compose dev keeps the docker-db-init.sh path.
CMD ["sh", "-c", "if [ \"$AUTO_MIGRATE\" = \"true\" ]; then sh scripts/bootstrap-render-db.sh || exit 1; fi; exec node src/server.js"]
