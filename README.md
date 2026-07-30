# 달팽이 클라이밍

2D 물리 기반 수직 클라이밍 미니게임이다. 플레이어는 절벽 아래로 떨어진 남자 달팽이를 조작해 정상으로 다시 올라가야 한다.

## 핵심 콘셉트

- 느리지만 안정적으로 오르는 일반 상태
- 빠르지만 위험한 껍질 상태
- 물리 반동과 기믹을 활용한 기록 단축
- 큰 낙하 위험을 감수하는 리스크와 리턴 구조

현재 저장소는 초기 프로젝트 구축 단계다. 세부 이동 수치, 물리 수치, 레벨 구조, 체크포인트 정책은 아직 확정하지 않는다.

## 기술 스택

- TypeScript
- Phaser 3
- Phaser Matter Physics
- Vite
- ESLint
- Prettier
- Vitest
- GitHub Pages

## 로컬 실행

```bash
npm install
npm run dev
```

## 검사 명령어

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
```

## 빌드

```bash
npm run build
```

## 프로젝트 구조

```text
.
├── notes/
├── public/assets/
├── src/
│   ├── config/
│   ├── entities/
│   ├── scenes/
│   ├── states/
│   ├── systems/
│   ├── ui/
│   └── utils/
└── tests/
```

## 개발 문서

- 에이전트 작업 규칙: [`AGENTS.md`](./AGENTS.md)
- 게임 콘셉트: [`notes/game-concept.md`](./notes/game-concept.md)
- 아키텍처: [`notes/architecture.md`](./notes/architecture.md)
- 개발 방법: [`notes/development.md`](./notes/development.md)
- 기술적 의사결정: [`notes/decisions.md`](./notes/decisions.md)

## 기여 및 작업 규칙

상세 작업 규칙은 `AGENTS.md`를 따른다. 프로젝트 내부 개발 문서는 `notes/` 아래에 작성한다.

## 배포 주소

GitHub Pages 배포 주소는 배포 설정이 완료된 뒤 갱신한다.
