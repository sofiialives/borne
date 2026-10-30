FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
RUN npm install
COPY shared shared
COPY frontend frontend
RUN npm run build --workspace=@borne/shared
ARG VITE_API_URL=http://localhost:4000
ARG VITE_KIOSK_URL=http://localhost:4100
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_KIOSK_URL=${VITE_KIOSK_URL}
RUN npm run build --workspace=@borne/frontend

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
