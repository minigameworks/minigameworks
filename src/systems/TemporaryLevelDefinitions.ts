import { GAME_CANVAS, TEMPORARY_SNAIL_MARKER } from '../config/gameConstants';

export type TemporaryPlatformDefinition = {
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
};

export type TemporaryLevelDefinition = {
    key: string;
    name: string;
    world: {
        width: number;
        height: number;
        wallThickness: number;
    };
    startPosition: {
        x: number;
        y: number;
    };
    platforms: TemporaryPlatformDefinition[];
};

export const DEFAULT_GIMMICK_CASE_KEY = 'slope-transfer';

const TEMPORARY_WALL_THICKNESS = 24;
const MAIN_VERTICAL_LEVEL_HEIGHT = GAME_CANVAS.height * 3;

const createDefaultStartPosition = (height: number): { x: number; y: number } => ({
    x: GAME_CANVAS.width / 2,
    y: height - TEMPORARY_WALL_THICKNESS - TEMPORARY_SNAIL_MARKER.normalSegmentRadius,
});

const fromBottom = (height: number, offset: number): number => height - offset;

// 임시 메인 수직 레벨이다. 최종 맵 길이와 구조가 아니며, 위쪽 구간을 붙이는 흐름 검증용이다.
export const TEMPORARY_MAIN_LEVEL: TemporaryLevelDefinition = {
    key: 'main-vertical',
    name: '임시 메인 수직 레벨',
    world: {
        width: GAME_CANVAS.width,
        height: MAIN_VERTICAL_LEVEL_HEIGHT,
        wallThickness: TEMPORARY_WALL_THICKNESS,
    },
    startPosition: createDefaultStartPosition(MAIN_VERTICAL_LEVEL_HEIGHT),
    platforms: [
        {
            x: 150,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 90),
            width: 280,
            height: 20,
            angle: 18,
        },
        {
            x: GAME_CANVAS.width - TEMPORARY_WALL_THICKNESS - 130,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 210),
            width: 260,
            height: 22,
            angle: 0,
        },
        {
            x: GAME_CANVAS.width / 2 + 40,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 260),
            width: 210,
            height: 22,
            angle: 14,
        },
        {
            x: GAME_CANVAS.width / 2 - 120,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 560),
            width: 260,
            height: 22,
            angle: -12,
        },
        {
            x: GAME_CANVAS.width - TEMPORARY_WALL_THICKNESS - 170,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 780),
            width: 280,
            height: 22,
            angle: 0,
        },
        {
            x: GAME_CANVAS.width / 2 + 40,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 1030),
            width: 320,
            height: 22,
            angle: 16,
        },
    ],
};

// 기믹 패턴을 메인 맵까지 이동하지 않고 바로 검증하기 위한 플레이어블 케이스 레벨이다.
export const TEMPORARY_GIMMICK_CASE_LEVELS = {
    [DEFAULT_GIMMICK_CASE_KEY]: {
        key: DEFAULT_GIMMICK_CASE_KEY,
        name: '경사 접면 전환 케이스',
        world: {
            width: GAME_CANVAS.width,
            height: GAME_CANVAS.height,
            wallThickness: TEMPORARY_WALL_THICKNESS,
        },
        startPosition: createDefaultStartPosition(GAME_CANVAS.height),
        platforms: [
            {
                x: 180,
                y: fromBottom(GAME_CANVAS.height, 100),
                width: 310,
                height: 22,
                angle: 18,
            },
            {
                x: GAME_CANVAS.width - TEMPORARY_WALL_THICKNESS - 150,
                y: fromBottom(GAME_CANVAS.height, 240),
                width: 280,
                height: 22,
                angle: 0,
            },
            {
                x: GAME_CANVAS.width / 2,
                y: fromBottom(GAME_CANVAS.height, 330),
                width: 240,
                height: 22,
                angle: -16,
            },
        ],
    },
} as const satisfies Record<string, TemporaryLevelDefinition>;

export const getTemporaryGimmickCaseLevel = (key: string | null): TemporaryLevelDefinition => {
    if (key && key in TEMPORARY_GIMMICK_CASE_LEVELS) {
        return TEMPORARY_GIMMICK_CASE_LEVELS[key as keyof typeof TEMPORARY_GIMMICK_CASE_LEVELS];
    }

    return TEMPORARY_GIMMICK_CASE_LEVELS[DEFAULT_GIMMICK_CASE_KEY];
};
