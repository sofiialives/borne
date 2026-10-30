FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/package.json
COPY kiosk-server/package.json kiosk-server/package.json
RUN npm install
COPY shared shared
COPY kiosk-server kiosk-server
RUN npm run build --workspace=@borne/shared
RUN npm run build --workspace=@borne/kiosk-server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared ./shared
COPY --from=build /app/kiosk-server/dist ./kiosk-server/dist
COPY --from=build /app/kiosk-server/package.json ./kiosk-server/package.json
VOLUME ["/app/data"]
ENV KIOSK_DB_PATH=/app/data/kiosk-local.sqlite
EXPOSE 4100
CMD ["node", "kiosk-server/dist/index.js"]
