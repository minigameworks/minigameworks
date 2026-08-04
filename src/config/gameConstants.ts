// 게임 캔버스의 기준 해상도다. 실제 화면에는 Phaser Scale 설정에 따라 비율을 유지하며 맞춰진다.
export const GAME_CANVAS = {
    width: 960,
    height: 540,
} as const;

// Phaser가 생성한 canvas를 붙일 HTML 엘리먼트 id다.
export const GAME_PARENT_ID = 'app';

// 게임 배경색이다. 현재는 초기 화면 확인용 색상이며 최종 그래픽 톤이 아니다.
export const GAME_BACKGROUND_COLOR = '#14213d';

// Matter Physics 전역 설정이다. 중력은 초기 확인용 값이며 최종 물리 수치가 아니다.
export const MATTER_CONFIG = {
    gravity: {
        x: 0,
        y: 0.8,
    },
    // 숨긴 물리 바디가 화면에 노출되지 않도록 디버그 표시는 기본 비활성화한다.
    debug: false,
} as const;

// 플레이 공간과 배경을 구분하기 위한 색상이다. 최종 아트 스타일이 아니다.
export const SCENE_COLORS = {
    background: 0x2f3e46,
    playfield: 0x52796f,
    wall: 0x354f52,
    ground: 0x84a98c,
    platform: 0xcce3de,
    slipperyPlatform: 0x9bf6ff,
} as const;

// 달팽이 캐릭터 표시와 물리 기준 설정이다.
export const SNAIL_MARKER = {
    normalSize: 44,
    normalSegmentRadius: 13,
    normalSegmentSpacing: 20,
    normalConnectorWidth: 26,
    normalConnectorHeight: 16,
    shellRadius: 22,
    normalColor: 0xf4d35e,
    normalBackColor: 0xf7c948,
    normalConnectorColor: 0xf2d06b,
    shellColor: 0xf77f00,
    directionColor: 0x14213d,
    inputDirectionColor: 0xd81159,
    backDirectionColor: 0x2ec4b6,
    directionArrowLength: 18,
    directionArrowWidth: 12,
    directionArrowGap: 3,
    inputArrowLength: 16,
    inputArrowWidth: 9,
    backMarkerLength: 18,
    backMarkerWidth: 5,
    restitution: 0.2,
    surfaceRotationLerp: 0.22,
} as const;

// 달팽이 조작 설정이다. 최종 이동 속도와 조작감은 별도 게임플레이 튜닝에서 결정한다.
export const SNAIL_CONTROL = {
    normalMoveSpeed: 1.4,
    normalClimbSpeed: 1.2,
    normalClimbDownSpeed: 1.4,
    normalAttachMoveSpeed: 1.4,
    normalSlopeClimbMaxSpeed: 2.8,
    normalSlopeClimbMaxVerticalSpeed: 1.8,
    normalPassiveSlideSpeed: 0.35,
    shellMoveAcceleration: 0.42,
    shellAirMoveAcceleration: 0.14,
    shellGroundFriction: 0.965,
    shellAirFriction: 0.99,
    shellMaxHorizontalSpeed: 7,
    shellJumpVelocity: -4.8,
    shortHopFallAcceleration: 0.55,
    modeSwitchAttachCooldownMs: 180,
    shellSlopePassiveAcceleration: 0.08,
    shellSlopeInputAcceleration: 1.25,
    shellSlopePassiveMaxSpeed: 3.2,
    shellSlopeInputMaxSpeed: 11,
    contactTolerance: 18,
    surfaceInputThreshold: 0.25,
    surfaceContactGraceMs: 90,
    surfaceSwitchLockMs: 120,
    surfaceSwitchProjectionMargin: 0.12,
    surfaceEndProgressTolerance: 0.02,
    surfaceConnectionTolerance: 6,
    slipperyKnockbackSpeed: 2.4,
    slipperyKnockbackFallSpeed: 2.2,
    slipperyKnockbackCooldownMs: 180,
} as const;
