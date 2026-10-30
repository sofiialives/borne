FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
RUN npm install
COPY shared shared
COPY backend backend
RUN npm run build --workspace=@borne/shared
RUN npm run build --workspace=@borne/backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/shared ./shared
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/drizzle ./backend/drizzle
EXPOSE 4000
CMD ["node", "backend/dist/index.js"]
