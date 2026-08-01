# 에이전트 작업 지침

## 프로젝트 개요

이 저장소는 GitHub Pages에 배포 가능한 2D 물리 기반 수직 클라이밍 미니게임을 개발한다. 플레이어는 떨어진 남자 달팽이를 조작해 절벽 정상까지 다시 올라가는 경험을 만든다.

초기 단계에서는 프로젝트 실행 기반과 개발 규칙을 세운다. 이동 속도, 점프 강도, 중력, 마찰, 탄성, 체크포인트, 사망 처리, 레벨 구조 같은 세부 게임 규칙은 별도 명세가 나오기 전까지 확정하지 않는다.

## 기술 스택

- TypeScript
- Phaser 3
- Phaser Matter Physics
- Vite
- npm
- ESLint
- Prettier
- Vitest
- GitHub Pages

React, Vue, Svelte 같은 UI 프레임워크는 초기 단계에 추가하지 않는다. Matter.js는 별도 패키지로 중복 설치하지 않고 Phaser 통합 기능을 사용한다.

## 문서 언어

README, notes 문서, 주석, 커밋 메시지, PR 제목과 본문은 한국어로 작성한다.

## 작업 시작 절차

작업 시작 전 다음 순서로 확인한다.

1. 루트의 `AGENTS.md`
2. 관련 `notes/` 문서
3. `README.md`
4. 현재 브랜치와 Git 상태
5. 관련 소스 코드와 테스트
6. 관련 GitHub Issue 또는 Pull Request

기본 확인 명령은 다음과 같다.

```bash
git status
git branch --show-current
git log -5 --oneline
gh auth status
gh repo view
```

기존 변경 사항은 임의로 삭제하거나 되돌리지 않는다.

## 작업 범위 제한

- 요청 범위에 필요한 파일만 변경한다.
- 사용자가 명시하지 않은 게임 규칙을 임의로 확정하지 않는다.
- 임시 수치를 사용할 때는 코드나 문서에 임시값임을 표시한다.
- 불필요한 리팩터링과 의존성 추가를 함께 진행하지 않는다.
- 새로운 의존성을 추가하면 PR 본문이나 작업 보고에 이유를 적는다.

## 브랜치 규칙

모든 일반 개발 작업은 임의 브랜치가 아니라 GitHub Issue를 기준으로 시작한다. 작업 전에 관련 Issue를 확인하고, 없으면 작업 내용을 설명하는 Issue를 먼저 만든 뒤 해당 Issue 번호를 기준으로 브랜치를 생성한다.

기본 브랜치에서 직접 진행하지 않고 작업 브랜치를 생성한다. 단, 사용자가 현재 작업에서 기본 브랜치 진행을 명시하면 그 지시를 우선한다.

브랜치명은 영문 소문자와 하이픈을 사용한다.

예:

- `feat/1-project-bootstrap`
- `feat/12-snail-state-machine`
- `fix/23-camera-follow`
- `docs/34-update-agent-rules`
- `chore/45-configure-lint`

## 커밋 규칙

커밋 메시지는 Conventional Commits 유형을 사용하고 제목과 본문은 한국어로 작성한다.

커밋 메시지는 제목과 변경 내용 본문을 함께 작성한다. 본문에는 영향받은 파일 또는 영역을 함께 적어 변경 의도를 추적할 수 있게 한다.

형식:

```text
<유형>: <한국어 제목>

변경 내용
- `<파일 또는 영역>`: 변경 내용을 설명한다.
- `<파일 또는 영역>`: 변경 내용을 설명한다.
```

예:

```text
feat: 달팽이 상태 전환 구조 추가

변경 내용
- `src/entities/SnailPlayer.ts`: 일반 상태와 껍질 상태 전환 흐름을 추가한다.
- `src/config/gameConfig.ts`: 상태별 임시 물리 설정을 분리한다.
```

의미 없는 메시지나 불완전한 작업 상태의 커밋은 금지한다.

PR 병합 전에는 브랜치에 남은 작업 커밋을 하나의 의미 있는 커밋으로 스쿼시한다. 기본 브랜치에는 스쿼시된 단일 작업 커밋을 포함한 PR을 merge commit 방식으로 병합한다.

## Pull Request 규칙

PR 제목과 본문은 한국어로 작성한다. PR 본문에는 작업 개요, 주요 변경 사항, 변경 이유, 검증 결과, 제외한 범위, 참고 사항을 포함한다.

PR은 반드시 관련 Issue를 연결하고 한 가지 목적에 집중한다. 병합은 사용자 명시 요청 없이는 수행하지 않는다.

PR 병합 방식은 merge commit을 사용한다. 단, 병합 전에 PR 브랜치의 잔여 작업 커밋은 1개의 커밋으로 정리되어 있어야 한다.

## `gh` 사용 규칙

GitHub 작업은 웹 UI보다 `gh`를 우선 사용한다.

사용 대상:

- 저장소 정보 확인
- Issue와 PR 조회
- PR 생성과 수정
- 라벨 확인과 생성
- CI 상태 확인
- 원격 브랜치 푸시

강제 푸시, 브랜치 삭제, 태그 생성, 릴리스 생성, 저장소 설정 변경은 사용자 지시 없이 수행하지 않는다.

## Issue 생성 규칙

Issue를 만들 때는 다음 정보를 함께 설정한다.

- 할당자: 기본적으로 `@me`를 지정한다.
- 타입: GitHub Issue Type을 사용한다. 기능 작업은 기본적으로 `Feature`를 지정한다.
- 기간: GitHub Issue Fields의 `Start date`와 `Target date`를 사용한다.
- 우선순위와 작업량: GitHub Issue Fields의 `Priority`와 `Effort`를 사용한다.

사용자가 별도 기간을 지정하지 않고 오늘 작업으로 요청하면 `Start date`와 `Target date`를 모두 오늘 날짜로 설정한다. 사용자가 우선순위나 작업량을 지정하지 않으면 작업 성격에 맞게 보수적으로 설정한다.

Issue Type과 Issue Fields는 본문에 `## 타입`, `## 기간` 같은 섹션으로 중복 작성하지 않는다. `gh issue create`가 해당 필드를 직접 지원하지 않으면 `gh api`로 이슈 생성 후 메타 필드를 갱신한다.

Issue 본문은 반드시 실제 줄바꿈이 들어간 Markdown 파일을 `--body-file`로 전달한다. `--body` 인자에 `\n` 문자열을 직접 넣어 Markdown 줄바꿈이 깨지게 만들지 않는다.

## 코드 스타일

- 들여쓰기는 스페이스 4칸을 사용한다.
- 문자열은 작은따옴표를 기본으로 사용한다.
- 문장 끝에는 세미콜론을 사용한다.
- 한 줄은 100자를 기준으로 한다.
- TypeScript 엄격 모드를 유지한다.
- 불필요한 `any`, 사용하지 않는 변수와 import를 남기지 않는다.
- 스타일 포맷은 Prettier에 맡긴다.

## 테스트 및 검증 규칙

변경 후 가능한 한 다음 명령을 실행한다.

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
```

초기 테스트는 Phaser 렌더링 전체보다 상태 머신, 시간 포맷, 기록 비교, 설정 검증 같은 순수 로직에 집중한다.

## 문서 작성 위치

프로젝트 내부 개발 문서는 `docs/`가 아니라 `notes/` 아래에 작성한다.

기본 문서:

- `notes/game-concept.md`
- `notes/architecture.md`
- `notes/development.md`
- `notes/decisions.md`

## 금지 사항

- 비밀값과 토큰 커밋
- 빌드 산출물 커밋
- 사용자 변경 사항 임의 삭제
- 세부 게임 규칙 임의 확정
- 불필요한 라이브러리 추가
- 기본 브랜치 직접 푸시, 강제 푸시, 사용자 지시 없는 PR 병합
- Issue 없이 임의 브랜치에서 일반 개발 작업 진행

## 작업 완료 보고 형식

작업 완료 후 다음 내용을 한국어로 보고한다.

- 완료 내용
- 검증 결과
- Git 브랜치와 커밋
- Pull Request 상태
- 남은 사항과 제외한 범위
