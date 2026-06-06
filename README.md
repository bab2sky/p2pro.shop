# P2PRO Store Source Code

이 저장소는 P2PRO Store 순수 소스코드 전달본입니다.

프론트엔드는 TypeScript/React, 백엔드는 Rust로 구성되어 있습니다. 이 저장소는 소스 확인, 개발, 수정, 직접 실행 및 빌드를 위한 용도입니다.

## 1. 공통 준비

필요한 도구:

- Linux, macOS, 또는 Windows 개발 환경
- Node.js 22 이상
- npm
- Rust stable toolchain
- Docker Engine
- Docker Compose v2

확인:

```bash
node -v
npm -v
rustc --version
cargo --version
docker info
docker compose version
```

## 2. 프로젝트 구조

```text
apps/web/              P2PRO Store 웹 프론트엔드
apps/desktop/          Tauri 데스크톱 래퍼
packages/backend/      Rust 백엔드 API 서버
packages/types/        공유 TypeScript 타입
docker-compose.yml     개발용 PostgreSQL / Redis
```

## 3. 의존성 설치

```bash
npm install
```

## 4. 개발 DB/Redis 실행

```bash
docker compose up -d
```

이 compose는 개발용 PostgreSQL과 Redis만 실행합니다.

## 5. 환경변수 준비

백엔드용:

```bash
cp .env.example packages/backend/.env
```

프론트엔드용:

```bash
grep '^VITE_' .env.example > apps/web/.env.local
```

실제 API 키, wallet 주소, JWT secret은 필요에 맞게 수정합니다.

UDG World와 연동하려면 아래 값이 UDG 쪽 설정과 맞아야 합니다.

```text
UDG_WEBHOOK_URL
UDG_WEBHOOK_SECRET
JWT_SECRET
```

## 6. 백엔드 실행

```bash
cd packages/backend
cargo run
```

기본 포트:

```text
http://localhost:8080
```

## 7. 프론트엔드 실행

새 터미널에서:

```bash
npm run web:dev
```

Vite가 출력하는 로컬 주소로 접속합니다.

## 8. 빌드 확인

프론트엔드:

```bash
npm run web:build
```

백엔드:

```bash
cd packages/backend
cargo build --release
```

## 9. 운영 배포 참고

이 저장소에는 순수 소스코드만 포함되어 있습니다. 아래 항목은 포함하지 않았습니다.

- `.github/`
- `infra/`
- `*.conf`
- `Dockerfile`
- 실제 운영 `.env`
- `node_modules/`
- `dist/`
- `target/`

따라서 이 저장소만으로 운영 배포를 진행하려면 운영 환경에 맞게 아래 항목을 별도로 준비해야 합니다.

- 운영 환경변수
- PostgreSQL / Redis
- 프론트엔드 정적 파일 빌드 및 서빙 방식
- Rust 백엔드 빌드 및 실행 방식
- HTTPS reverse proxy
- 프로세스 관리 또는 컨테이너 실행 구성
