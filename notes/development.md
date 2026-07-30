# 개발 방법

## 설치

```bash
npm install
```

## 로컬 실행

```bash
npm run dev
```

## 검사

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

## 포맷 적용

```bash
npm run format
```

## 빌드

```bash
npm run build
```

Vite의 `base`는 GitHub Pages 경로 대응을 위해 상대 경로인 `./`로 설정한다.

## 문서 규칙

개발 문서는 `docs/`가 아니라 `notes/` 아래에 작성한다.

## 후속 구현 원칙

- 세부 게임 수치는 확정 전까지 임시값으로 표시한다.
- Phaser 렌더링 테스트보다 순수 로직 테스트를 먼저 작성한다.
- UI는 기본적으로 Phaser 안에서 구현한다.
