FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV NODE_ENV=development
ENV LIBWEBP_ROOT=/opt/native
ENV LIBPNG_ROOT=/opt/native

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    libpng-dev \
    libwebp-dev \
    python3 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /opt/native/include /opt/native/lib \
  && cp -a /usr/include/webp /opt/native/include/webp \
  && ln -s /usr/include/png.h /opt/native/include/png.h \
  && ln -s /usr/include/pngconf.h /opt/native/include/pngconf.h \
  && ln -s /usr/include/pnglibconf.h /opt/native/include/pnglibconf.h \
  && ln -s /usr/lib/$(gcc -print-multiarch)/libwebp.so /opt/native/lib/libwebp.so \
  && ln -s /usr/lib/$(gcc -print-multiarch)/libpng.so /opt/native/lib/libpng.so

COPY package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts \
  && npm rebuild better-sqlite3

COPY . .
RUN DATABASE_URL=file:./database/konomi.db npx prisma generate \
  && npm run prebuild:native \
  && npm run build:web

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV KONOMI_WEB_MODE=1
ENV PORT=3000
ENV KONOMI_DATA_PATH=/app/.data
ENV KONOMI_USER_DATA=/app/.data
ENV KONOMI_MIGRATIONS_PATH=/app/prisma/migrations

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libpng16-16 \
    libwebp7 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prebuilds ./prebuilds
COPY --from=build /app/src ./src

EXPOSE 3000

CMD ["./node_modules/.bin/tsx", "src/server/index.ts"]
