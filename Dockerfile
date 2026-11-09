# 떡상개론 서버 이미지. 클라이언트(dist/)를 빌드해 함께 담고, 같은 서버가 화면과 WebSocket을 모두 제공합니다.
# 빌드:  docker build -t tteoksang .
# 실행:  docker run -p 8787:8787 -e DATABASE_URL=postgres://... tteoksang

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# embedded-postgres(테스트 전용)의 설치 스크립트는 필요 없으므로 건너뜁니다.
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY tsconfig.json ./
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/src/index.ts"]
