# 개발 방법

## 설치

```bash
npm install
```

## 로컬 실행

```bash
npm run dev
```

기본 메인 수직 레벨은 다음 주소에서 실행한다.

```text
http://localhost:5173/
```

기믹 케이스 레벨은 `case` 쿼리로 바로 실행한다.

```text
http://localhost:5173/?case=slope-transfer
```

현재 등록된 케이스와 검증 상태는 `notes/gimmick-cases.md`에서 관리한다.

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
- 신규 기믹은 메인 수직 맵에 바로 붙이기 전에 케이스 레벨에서 먼저 검증한다.
- 신규 기믹 케이스를 추가하면 `notes/gimmick-cases.md`에 실행 주소와 검증 상태를 함께 기록한다.
- 검증된 케이스 구간만 메인 수직 맵 상단에 붙이고, 이후 실제 레벨 데이터 구조로 분리한다.
