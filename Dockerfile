FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_ARCHIVAL_API_BASE_URL=/api
ARG VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD=true

ENV VITE_ARCHIVAL_API_BASE_URL=${VITE_ARCHIVAL_API_BASE_URL}
ENV VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD=${VITE_ARCHIVAL_DIRECT_PRESIGNED_UPLOAD}

RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine

ENV ARCHIVAL_API_PROXY_PASS=http://archival-processing-api:8000

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
