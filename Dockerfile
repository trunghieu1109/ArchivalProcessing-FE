FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_ARCHIVAL_API_BASE_URL=/api
ARG VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD=false

ENV VITE_ARCHIVAL_API_BASE_URL=${VITE_ARCHIVAL_API_BASE_URL}
ENV VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD=${VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD}

RUN npm run build

FROM nginx:1.27-alpine

ENV ARCHIVAL_API_PROXY_PASS=http://host.docker.internal:8000
ENV NGINX_CLIENT_MAX_BODY_SIZE=1g

COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
