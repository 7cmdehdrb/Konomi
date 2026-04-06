아래는 이 저장소(Konomi)의 구조/아키텍처와 Front-end, Back-end, 구현 기능에 대한 상세 분석입니다.

1) 한 줄 요약
이 프로젝트는 Electron + React + Prisma(SQLite) + Utility Process(백그라운드 워커) 구조를 사용하는 데스크톱 앱으로, 이미지 폴더 스캔/메타데이터 추출/검색/분류/유사도 분석/NovelAI 생성까지 한 앱에서 처리하도록 설계되어 있습니다. 

2) 저장소 구조(역할 중심)
빌드 문서 기준 핵심 구조는 다음과 같습니다:

src/main: Electron 메인 프로세스

src/main/lib: DB/스캔/메타데이터 등 코어 로직

src/main/utility.ts: 무거운 작업을 처리하는 유틸리티 프로세스 엔트리

src/preload: IPC 브리지

src/renderer/src: React UI

src/native/*: C++ 네이티브 애드온 (이미지 처리)

prisma: 스키마 + 마이그레이션 

Electron 빌드 구성에서 main 입력을 index.ts, utility.ts, nai.worker.ts, phash.worker.ts로 분리해 둔 점이 구조적으로 중요합니다(= UI 스레드와 무거운 작업 분리). 

3) 아키텍처 분석 (프로세스 관점)
A. Main Process
앱 시작 시 IPC 핸들러 등록, Dev 사용자 데이터 경로 설정, 메인 창 생성, 자동 업데이트 초기화 등을 수행합니다. 

konomi://local/... 커스텀 프로토콜을 통해 로컬 이미지 파일을 안전하게 서빙하며, 관리되지 않은 경로 접근은 차단합니다. 

썸네일은 디스크 캐시 + 네이티브 리사이즈 우선(실패 시 Electron fallback) 방식입니다. 

B. Utility Process (백엔드 핵심)
bridge를 통해 main↔utility 간 RPC 형태 요청/응답을 수행하며, 프로세스 종료 시 자동 재시작 로직도 있습니다. 

utility는 실제 비즈니스 로직(폴더 관리, 스캔, 해시/유사도, 카테고리, 프롬프트, NAI 생성)을 switch-case 라우팅으로 처리합니다. 

C. Preload (보안 경계)
contextBridge.exposeInMainWorld로 Renderer에 노출할 API를 명시으로 제한합니다.

image, folder, category, promptBuilder, nai, db, appInfo 단위로 API가 나뉘어 있습니다. 

4) Front-end 분석
기술 스택 및 UI 구성
React 기반이며, 루트 App에서 Header, Sidebar, ImageGallery, ImageDetail, SettingsView, PromptSearchView, GenerationView, DebugView를 패널 상태에 따라 전환합니다. 

Generator 뷰와 Gallery 영역을 “항상 mount + CSS/inert로 전환”하는 패턴을 사용해 UX 전환 비용을 줄이는 설계입니다. 

초기 부팅에서 DB migration 진행 상태와 폴더 개수를 바탕으로 Splash 상태를 제어합니다. 

i18n은 ko/en 리소스, system 언어 감지, 동적 적용(document.lang 반영) 구조입니다. 

생성 UI 특화 포인트
생성 서비스 타입은 novelai/webui이며 현재 WebUI는 disabled 처리되어 있습니다. 

캐릭터 프롬프트 포지션(그리드 좌표 A1~E5 + global) 같은 고급 제어 타입이 정의되어 있어 프롬프트 제어가 세분화되어 있습니다. 

5) Back-end 분석
데이터 모델
SQLite + Prisma이며 핵심 엔티티:

Folder, Image

Category/ImageCategory (커스텀 분류)

PromptCategory/PromptGroup/PromptToken (프롬프트 빌더)

ImageSearchStat (검색 프리셋 통계)

ImageSimilarityCache (유사도 캐시)

IgnoredDuplicatePath (중복 예외 경로)

NaiConfig (API 키 저장) 

메타데이터 파싱
PNG/WebP 버퍼 기준으로 WebUI, ComfyUI, Midjourney, NAI 메타 파서를 순차 시도합니다. WebP는 별도 NAI WebP 경로를 탑니다. 

스캔/감시/동기화
폴더 watcher가 .png/.webp 변경을 debounce 처리하고, 스캔 중엔 이벤트를 큐잉한 뒤 flush합니다. 

파일 삭제/변경 시 DB row, 유사도 캐시, 검색 통계를 함께 정리하는 일관성 유지 로직이 존재합니다. 

IPC 서비스 범위
이미지 페이지 조회, 스캔/취소, 유사도 분석, 프롬프트 빌더 CRUD, 카테고리 CRUD/색상, NAI 생성/설정까지 IPC 핸들러가 광범위합니다. 

6) 구현 기능 매핑 (요구하신 Front-end/Back-end 통합 관점)
README 기능 목록이 실제 코드 구조와 잘 대응됩니다:

폴더 기반 이미지 관리 + 검색/정렬/필터: image:listPage, 고급필터/패널 구조. 

즐겨찾기/커스텀 카테고리/랜덤 분류: 카테고리 API + 스키마. 

중복 감지/해결 플로우: folder duplicate 관련 IPC + utility 처리. 

유사 이미지 분석(pHash + Jaccard): 유사도 API 및 캐시 모델. F:README.md†L21-L21】

프롬프트 그룹 시스템: PromptCategory/Group/Token 모델 + CRUD IPC. 

NovelAI 생성: nai:* IPC + utility 라우팅 + generation view. 

ComfyUI 워크플로우 시각화/메타 호환: README 기능 + image-meta 파이프라인. 

7) 테스트/품질 구조
테스트는 backend(node 환경)와 frontend(jsdom 환경)로 분리되어 있고, workspace에서 둘을 묶어 실행하도록 구성되어 있습니다. 

package.json 스크립트에 typecheck/lint/test/build/db/native prebuild가 명확히 분리되어 있어 CI/로컬 운영이 수월한 편입니다. 

검토에 사용한 명령어
✅ rg --files | head -n 200

✅ sed -n '1,260p' README.md

✅ sed -n '1,320p' BUILDING.md

✅ cat package.json

✅ sed -n '1,220p' electron.vite.config.ts

✅ sed -n '1,520p' src/main/index.ts

✅ sed -n '1,680p' src/main/ipc.ts

✅ sed -n '1,740p' src/main/utility.ts

✅ sed -n '1,620p' src/preload/index.ts

✅ sed -n '1,320p' prisma/schema.prisma

✅ sed -n '1,260p' src/main/lib/image-meta.ts

✅ sed -n '1,280p' src/main/lib/watcher.ts

✅ sed -n '1,320p' src/renderer/src/App.tsx

✅ sed -n '1,360p' src/renderer/src/bootstrap-app.tsx

✅ sed -n '100,190p' src/renderer/src/components/generation-view.tsx

✅ cat vitest.workspace.ts && cat vitest.backend.config.ts && cat vitest.frontend.config.ts

✅ python - <<'PY' ... (디렉터리별 파일 수 집계)

✅ git status --short

원하시면 다음 답변에서 “실행 흐름 시퀀스 다이어그램(앱 시작 → 마이그레이션 → 스캔 → 갤러리 렌더)” 형태로 더 구조화해서 정리해드리겠습니다.