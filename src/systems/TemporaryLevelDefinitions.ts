import { GAME_CANVAS, TEMPORARY_SNAIL_MARKER } from '../config/gameConstants';

export type TemporaryGimmickObjectKind = 'field' | 'platform' | 'slope';

export type TemporarySurfaceFillMode = 'thin' | 'solid-to-bottom';

type TemporaryBaseObjectDefinition = {
    id: string;
    kind: TemporaryGimmickObjectKind;
    name: string;
};

export type TemporaryFieldObjectDefinition = TemporaryBaseObjectDefinition & {
    kind: 'field';
    width: number;
    height: number;
    wallThickness: number;
};

export type TemporarySurfaceObjectDefinition = TemporaryBaseObjectDefinition & {
    kind: 'platform' | 'slope';
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    fillMode: TemporarySurfaceFillMode;
};

export type TemporaryGimmickObjectDefinition =
    TemporaryFieldObjectDefinition | TemporarySurfaceObjectDefinition;

export type TemporaryLevelDefinition = {
    key: string;
    name: string;
    startPosition: {
        x: number;
        y: number;
    };
    objects: TemporaryGimmickObjectDefinition[];
};

export const DEFAULT_GIMMICK_CASE_KEY = 'slope-transfer';

const TEMPORARY_WALL_THICKNESS = 24;
const MAIN_VERTICAL_LEVEL_HEIGHT = GAME_CANVAS.height * 3;

const createDefaultStartPosition = (height: number): { x: number; y: number } => ({
    x: GAME_CANVAS.width / 2,
    y: height - TEMPORARY_WALL_THICKNESS - TEMPORARY_SNAIL_MARKER.normalSegmentRadius,
});

const fromBottom = (height: number, offset: number): number => height - offset;

const createFieldObject = (id: string, height: number): TemporaryFieldObjectDefinition => ({
    id,
    kind: 'field',
    name: '기본 필드',
    width: GAME_CANVAS.width,
    height,
    wallThickness: TEMPORARY_WALL_THICKNESS,
});

const createSurfaceObject = (
    options: Omit<TemporarySurfaceObjectDefinition, 'kind' | 'fillMode'> &
        Partial<Pick<TemporarySurfaceObjectDefinition, 'fillMode'>>,
): TemporarySurfaceObjectDefinition => ({
    ...options,
    kind: options.angle === 0 ? 'platform' : 'slope',
    fillMode: options.fillMode ?? 'thin',
});

export const getTemporaryLevelField = (
    level: TemporaryLevelDefinition,
): TemporaryFieldObjectDefinition => {
    const field = level.objects.find(
        (object): object is TemporaryFieldObjectDefinition => object.kind === 'field',
    );

    if (!field) {
        throw new Error(`임시 레벨 '${level.key}'에 필드 오브젝트가 없다.`);
    }

    return field;
};

export const getTemporaryLevelSurfaceObjects = (
    level: TemporaryLevelDefinition,
): TemporarySurfaceObjectDefinition[] =>
    level.objects.filter(
        (object): object is TemporarySurfaceObjectDefinition =>
            object.kind === 'platform' || object.kind === 'slope',
    );

// 임시 메인 수직 레벨이다. 최종 맵 길이와 구조가 아니며, 위쪽 구간을 붙이는 흐름 검증용이다.
export const TEMPORARY_MAIN_LEVEL: TemporaryLevelDefinition = {
    key: 'main-vertical',
    name: '임시 메인 수직 레벨',
    startPosition: createDefaultStartPosition(MAIN_VERTICAL_LEVEL_HEIGHT),
    objects: [
        createFieldObject('main-field', MAIN_VERTICAL_LEVEL_HEIGHT),
        createSurfaceObject({
            id: 'main-lower-left-slope',
            name: '하단 왼쪽 경사면',
            x: 150,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 90),
            width: 280,
            height: 20,
            angle: 18,
            fillMode: 'solid-to-bottom',
        }),
        createSurfaceObject({
            id: 'main-lower-right-platform',
            name: '하단 오른쪽 발판',
            x: GAME_CANVAS.width - TEMPORARY_WALL_THICKNESS - 130,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 210),
            width: 260,
            height: 22,
            angle: 0,
            fillMode: 'solid-to-bottom',
        }),
        createSurfaceObject({
            id: 'main-lower-transfer-slope',
            name: '하단 전환 경사면',
            x: GAME_CANVAS.width / 2 + 40,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 260),
            width: 210,
            height: 22,
            angle: 14,
        }),
        createSurfaceObject({
            id: 'main-mid-left-slope',
            name: '중단 왼쪽 경사면',
            x: GAME_CANVAS.width / 2 - 120,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 560),
            width: 260,
            height: 22,
            angle: -12,
        }),
        createSurfaceObject({
            id: 'main-mid-right-platform',
            name: '중단 오른쪽 발판',
            x: GAME_CANVAS.width - TEMPORARY_WALL_THICKNESS - 170,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 780),
            width: 280,
            height: 22,
            angle: 0,
        }),
        createSurfaceObject({
            id: 'main-upper-transfer-slope',
            name: '상단 전환 경사면',
            x: GAME_CANVAS.width / 2 + 40,
            y: fromBottom(MAIN_VERTICAL_LEVEL_HEIGHT, 1030),
            width: 320,
            height: 22,
            angle: 16,
        }),
    ],
};

// 기믹 패턴을 메인 맵까지 이동하지 않고 바로 검증하기 위한 플레이어블 케이스 레벨이다.
export const TEMPORARY_GIMMICK_CASE_LEVELS = {
    [DEFAULT_GIMMICK_CASE_KEY]: {
        key: DEFAULT_GIMMICK_CASE_KEY,
        name: '경사 접면 전환 케이스',
        startPosition: createDefaultStartPosition(GAME_CANVAS.height),
        objects: [
            createFieldObject('slope-transfer-field', GAME_CANVAS.height),
            createSurfaceObject({
                id: 'slope-transfer-entry-slope',
                name: '진입 경사면',
                x: 180,
                y: fromBottom(GAME_CANVAS.height, 100),
                width: 310,
                height: 22,
                angle: 18,
                fillMode: 'solid-to-bottom',
            }),
            createSurfaceObject({
                id: 'slope-transfer-wall-platform',
                name: '오른쪽 벽 부착 발판',
                x: GAME_CANVAS.width - TEMPORARY_WALL_THICKNESS - 150,
                y: fromBottom(GAME_CANVAS.height, 240),
                width: 280,
                height: 22,
                angle: 0,
            }),
            createSurfaceObject({
                id: 'slope-transfer-exit-slope',
                name: '반대 방향 경사면',
                x: GAME_CANVAS.width / 2,
                y: fromBottom(GAME_CANVAS.height, 330),
                width: 240,
                height: 22,
                angle: -16,
            }),
        ],
    },
} as const satisfies Record<string, TemporaryLevelDefinition>;

export const getTemporaryGimmickCaseLevel = (key: string | null): TemporaryLevelDefinition => {
    if (key && key in TEMPORARY_GIMMICK_CASE_LEVELS) {
        return TEMPORARY_GIMMICK_CASE_LEVELS[key as keyof typeof TEMPORARY_GIMMICK_CASE_LEVELS];
    }

    return TEMPORARY_GIMMICK_CASE_LEVELS[DEFAULT_GIMMICK_CASE_KEY];
};
