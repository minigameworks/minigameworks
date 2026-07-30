# 아키텍처

## 프로젝트 구조

- `src/config`: Phaser와 게임 전역 설정
- `src/scenes`: Phaser Scene
- `src/entities`: 게임 오브젝트와 엔티티
- `src/states`: 상태 머신과 상태 정의
- `src/systems`: 입력, 물리 보조, 기록 같은 시스템 로직
- `src/ui`: Phaser 내부 HUD와 UI
- `src/utils`: 테스트 가능한 순수 유틸리티
- `public/assets`: 정적 에셋
- `tests`: Vitest 테스트

## Scene 구조

현재는 `BootScene` 하나만 둔다. 이 Scene은 Phaser와 Matter Physics 연결을 확인하기 위한 최소 화면만 렌더링한다.

후속 작업에서 시작 화면, 게임 Scene, 결과 Scene 등을 분리한다.

## 상태 관리

달팽이의 일반 상태와 껍질 상태는 후속 작업에서 `src/states` 아래의 순수 상태 머신으로 먼저 정의한다. Phaser Scene은 상태 머신 결과를 읽어 물리 바디와 애니메이션에 반영하는 방향을 우선한다.

## 물리 엔진

Matter Physics는 Phaser 통합 기능을 사용한다. Matter.js를 별도 패키지로 설치하지 않는다.

현재 설정의 중력과 디버그 표시는 실행 확인용 임시값이며 최종 게임 규칙이 아니다.
