# Deployment Guide

This guide covers deployment options for the Mental Health Tracker Application.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Docker Deployment](#docker-deployment)
7. [Security Checklist](#security-checklist)

## Prerequisites

### Required Software
- Node.js 18+ LTS
- PostgreSQL 14+
- npm or yarn
- Git

### Cloud Platform Options
- Heroku
- AWS (EC2, RDS, S3)
- DigitalOcean
- Render
- Railway
- Vercel (frontend only)
- Netlify (frontend only)

## Environment Setup

### Backend Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
DB_HOST=your-db-host
DB_PORT=5432
DB_NAME=mental_health_tracker
DB_USER=your-db-user
DB_PASSWORD=your-secure-password

# Security (Generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRE=7d
ENCRYPTION_KEY=your-encryption-key-32-characters-minimum

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Logging
LOG_LEVEL=info
```

### Frontend Environment Variables

Create a `.env` file in the `frontend` directory:

```env
VITE_API_BASE_URL=https://your-backend-api.com/api
```

## Database Setup

### PostgreSQL on Cloud Platforms

#### AWS RDS
1. Create PostgreSQL instance in RDS
2. Configure security groups
3. Note connection details
4. Run schema: `psql -h your-host -U your-user -d mental_health_tracker -f database/schema.sql`

#### Heroku Postgres
```bash
heroku addons:create heroku-postgresql:hobby-dev
heroku pg:psql < database/schema.sql
```

#### DigitalOcean Managed Database
1. Create PostgreSQL cluster
2. Add trusted sources
3. Get connection string
4. Run schema via psql

### Database Migration

For schema updates in production:

```bash
# Backup first
pg_dump -h your-host -U your-user mental_health_tracker > backup.sql

# Run migrations
psql -h your-host -U your-user -d mental_health_tracker -f database/migrations/001_update.sql
```

## Backend Deployment

### Option 1: Heroku

```bash
cd backend

# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
heroku config:set ENCRYPTION_KEY=your-key

# Add buildpack
heroku buildpacks:set heroku/nodejs

# Deploy
git push heroku main

# Check logs
heroku logs --tail
```

### Option 2: AWS EC2

```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
git clone your-repo-url
cd backend

# Install dependencies
npm install --production

# Install PM2 for process management
sudo npm install -g pm2

# Create .env file with production values
nano .env

# Start application
pm2 start src/server.js --name mental-health-api

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
```

### Option 3: Docker (Recommended)

Create `backend/Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
```

Create `docker-compose.yml` in project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: mental_health_tracker
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: mental_health_tracker
      DB_USER: postgres
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      NODE_ENV: production
    depends_on:
      - postgres

volumes:
  postgres_data:
```

Deploy with Docker:
```bash
docker-compose up -d
```

## Frontend Deployment

### Option 1: Vercel

```bash
cd frontend

# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# VITE_API_BASE_URL=https://your-backend-api.com/api
```

### Option 2: Netlify

```bash
cd frontend

# Build
npm run build

# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod --dir=dist

# Set environment variable in Netlify dashboard
# VITE_API_BASE_URL=https://your-backend-api.com/api
```

### Option 3: AWS S3 + CloudFront

```bash
cd frontend

# Build
npm run build

# Upload to S3
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

### Option 4: Nginx (Self-hosted)

```bash
cd frontend

# Build
npm run build

# Copy to nginx web root
sudo cp -r dist/* /var/www/html/

# Nginx configuration
sudo nano /etc/nginx/sites-available/mental-health-tracker
```

Nginx config:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/mental-health-tracker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## SSL/TLS Configuration

### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal (already set up by certbot)
sudo certbot renew --dry-run
```

## Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET (32+ characters)
- [ ] Generate strong ENCRYPTION_KEY (32+ characters)
- [ ] Enable SSL/TLS (HTTPS)
- [ ] Set NODE_ENV=production
- [ ] Configure CORS with specific origins
- [ ] Enable rate limiting
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Enable security headers (Helmet.js)
- [ ] Set up monitoring and logging
- [ ] Disable debug mode
- [ ] Remove test accounts
- [ ] Audit dependencies (npm audit)
- [ ] Set up automated backups
- [ ] Configure CDN for static assets
- [ ] Enable DDoS protection
- [ ] Set up health check endpoints
- [ ] Configure error alerting

## Monitoring

### Health Check Endpoint

The application includes a health check at:
```
GET /health
```

Response:
```json
{
  "success": true,
  "message": "Mental Health Tracker API is running",
  "timestamp": "2024-12-30T...",
  "environment": "production"
}
```

### Logging

Logs are stored in `backend/logs/`:
- `error.log` - Error level logs
- `combined.log` - All logs

Monitor logs with:
```bash
# PM2
pm2 logs mental-health-api

# Docker
docker-compose logs -f backend

# Direct file
tail -f backend/logs/combined.log
```

### Monitoring Tools

Recommended monitoring solutions:
- **Application Performance**: New Relic, Datadog
- **Error Tracking**: Sentry
- **Uptime Monitoring**: UptimeRobot, Pingdom
- **Log Management**: LogRocket, Loggly

## Backup Strategy

### Database Backups

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="mental_health_tracker"

pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Delete backups older than 30 days
find $BACKUP_DIR -type f -name "backup_*.sql.gz" -mtime +30 -delete
```

Add to crontab:
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup-script.sh
```

## Scaling Considerations

### Horizontal Scaling
- Load balance multiple backend instances
- Use Redis for session storage
- Implement database read replicas
- Use CDN for static assets

### Vertical Scaling
- Increase instance size
- Optimize database queries
- Add database indexes
- Enable query caching

## Rollback Procedure

In case of deployment issues:

```bash
# Docker
docker-compose down
git checkout previous-version
docker-compose up -d

# PM2
pm2 stop mental-health-api
git checkout previous-version
npm install
pm2 restart mental-health-api

# Heroku
heroku rollback
```

## Support

For deployment issues:
- Check application logs
- Verify environment variables
- Test database connection
- Check firewall rules
- Verify SSL certificates
- Review security groups

---

**Note**: Always test deployments in a staging environment before deploying to production.
