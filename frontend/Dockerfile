# Mindspace frontend — React / Vite, served via nginx
# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# API base URL is baked at build time; override with --build-arg if needed
ARG VITE_API_BASE_URL=http://localhost:5000/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---- Serve stage ----
FROM nginx:alpine

# SPA-aware nginx config (history-API fallback + optional API proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static build output
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
