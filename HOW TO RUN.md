# .env 파일 내용
KONOMI_DATA_PATH=./.data
# 다른 컴퓨터에 있는 실제 이미지 폴더 절대 경로 (콤마 구문)
ALLOWED_ROOT_PATHS=D:/Photos,E:/Images
PORT=3000


# .env 파일 내용
KONOMI_DATA_PATH=./.data
# 다른 컴퓨터에 있는 실제 이미지 폴더 절대 경로 (콤마 구문)
ALLOWED_ROOT_PATHS=D:/Photos,E:/Images
PORT=3000


# 1. 프론트엔드를 정적 파일 보따리(dist)로 빌드해 둡니다.
npm run build:web

# 2. 프로덕션 환경 변수를 주입해서 백엔드만 킵니다. (윈도우 기준)
cmd /c "set NODE_ENV=production && npm run dev:web"


---

# 첫 번째 터미널 (백엔드)
npm run dev:web

# 두 번째 터미널 (프론트엔드)
npx vite dev -c vite.web.config.ts --host
