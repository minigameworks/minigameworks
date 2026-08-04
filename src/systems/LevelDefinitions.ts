import { GAME_CANVAS, SNAIL_MARKER } from '../config/gameConstants';

export type GimmickObjectKind = 'field' | 'surface' | 'terrain' | 'surface-line';

export type SurfaceFillMode = 'thin' | 'solid-to-bottom';
export type SurfaceMaterial = 'default' | 'slippery';

export type SurfaceMaterialSection = {
    id: string;
    name: string;
    startRatio: number;
    endRatio: number;
    material: SurfaceMaterial;
};

type BaseObjectDefinition = {
    id: string;
    kind: GimmickObjectKind;
    name: string;
};

export type FieldObjectDefinition = BaseObjectDefinition & {
    kind: 'field';
    width: number;
    height: number;
    wallThickness: number;
};

export type SurfaceObjectDefinition = BaseObjectDefinition & {
    kind: 'surface';
    x: number;
    y: number;
    width: number;
    height: number;
    angle: number;
    fillMode: SurfaceFillMode;
    material: SurfaceMaterial;
    surfaceSections: SurfaceMaterialSection[];
};

export type TerrainObjectDefinition = BaseObjectDefinition & {
    kind: 'terrain';
    x: number;
    y: number;
    tileSize: number;
    columns: number;
    rows: number;
    tiles: boolean[];
    material: SurfaceMaterial;
};

export type SurfaceLineObjectDefinition = BaseObjectDefinition & {
    kind: 'surface-line';
    start: {
        x: number;
        y: number;
    };
    end: {
        x: number;
        y: number;
    };
    normal: {
        x: number;
        y: number;
    };
    material: SurfaceMaterial;
    colliderVertices?: Array<{
        x: number;
        y: number;
    }>;
    surfaceSections: SurfaceMaterialSection[];
};

export type GimmickObjectDefinition =
    | FieldObjectDefinition
    | SurfaceObjectDefinition
    | TerrainObjectDefinition
    | SurfaceLineObjectDefinition;

export type LevelDefinition = {
    key: string;
    name: string;
    startPosition: {
        x: number;
        y: number;
    };
    objects: GimmickObjectDefinition[];
};

export const DEFAULT_GIMMICK_CASE_KEY = 'slope-transfer';
export const PILLAR_GAP_CASE_KEY = 'pillar-gap';
export const SLIPPERY_SLOPE_CASE_KEY = 'slippery-slope';

const WALL_THICKNESS = 24;

const createDefaultStartPosition = (height: number): { x: number; y: number } => ({
    x: GAME_CANVAS.width / 2,
    y: height - WALL_THICKNESS - SNAIL_MARKER.normalSegmentRadius,
});

const fromBottom = (height: number, offset: number): number => height - offset;

const createFieldObject = (id: string, height: number): FieldObjectDefinition => ({
    id,
    kind: 'field',
    name: '기본 필드',
    width: GAME_CANVAS.width,
    height,
    wallThickness: WALL_THICKNESS,
});

const createSurfaceObject = (
    options: Omit<SurfaceObjectDefinition, 'kind' | 'fillMode' | 'material' | 'surfaceSections'> &
        Partial<Pick<SurfaceObjectDefinition, 'fillMode' | 'material' | 'surfaceSections'>>,
): SurfaceObjectDefinition => ({
    ...options,
    kind: 'surface',
    fillMode: options.fillMode ?? 'thin',
    material: options.material ?? 'default',
    surfaceSections: options.surfaceSections ?? [],
});

export const getLevelField = (level: LevelDefinition): FieldObjectDefinition => {
    const field = level.objects.find(
        (object): object is FieldObjectDefinition => object.kind === 'field',
    );

    if (!field) {
        throw new Error(`레벨 '${level.key}'에 필드 오브젝트가 없다.`);
    }

    return field;
};

export const getLevelSurfaceObjects = (level: LevelDefinition): SurfaceObjectDefinition[] =>
    level.objects.filter((object): object is SurfaceObjectDefinition => object.kind === 'surface');

export const getLevelTerrainObjects = (level: LevelDefinition): TerrainObjectDefinition[] =>
    level.objects.filter((object): object is TerrainObjectDefinition => object.kind === 'terrain');

export const getLevelSurfaceLineObjects = (level: LevelDefinition): SurfaceLineObjectDefinition[] =>
    level.objects.filter(
        (object): object is SurfaceLineObjectDefinition => object.kind === 'surface-line',
    );

// 기믹 패턴을 메인 맵까지 이동하지 않고 바로 검증하기 위한 플레이어블 케이스 레벨이다.
export const GIMMICK_CASE_LEVELS = {
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
                x: GAME_CANVAS.width - WALL_THICKNESS - 150,
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
    [PILLAR_GAP_CASE_KEY]: {
        key: PILLAR_GAP_CASE_KEY,
        name: '기둥과 낭떠러지 케이스',
        startPosition: {
            x: 120,
            y: GAME_CANVAS.height - WALL_THICKNESS - SNAIL_MARKER.normalSegmentRadius,
        },
        objects: [
            createFieldObject('pillar-gap-field', GAME_CANVAS.height),
            createSurfaceObject({
                id: 'pillar-gap-left-pillar',
                name: '왼쪽 기둥',
                x: 230,
                y: fromBottom(GAME_CANVAS.height, 190),
                width: 110,
                height: 22,
                angle: 0,
                fillMode: 'solid-to-bottom',
            }),
            createSurfaceObject({
                id: 'pillar-gap-right-pillar',
                name: '오른쪽 기둥',
                x: 500,
                y: fromBottom(GAME_CANVAS.height, 165),
                width: 120,
                height: 22,
                angle: 0,
                fillMode: 'solid-to-bottom',
            }),
            createSurfaceObject({
                id: 'pillar-gap-risk-slope',
                name: '낭떠러지 진입 경사면',
                x: 700,
                y: fromBottom(GAME_CANVAS.height, 240),
                width: 240,
                height: 22,
                angle: -14,
            }),
            createSurfaceObject({
                id: 'pillar-gap-upper-platform',
                name: '상단 회수 발판',
                x: GAME_CANVAS.width - WALL_THICKNESS - 120,
                y: fromBottom(GAME_CANVAS.height, 330),
                width: 220,
                height: 22,
                angle: 0,
            }),
        ],
    },
    [SLIPPERY_SLOPE_CASE_KEY]: {
        key: SLIPPERY_SLOPE_CASE_KEY,
        name: 'ㄱ자 미끄럼 표면 케이스',
        startPosition: {
            x: 300,
            y: GAME_CANVAS.height - WALL_THICKNESS - SNAIL_MARKER.normalSegmentRadius,
        },
        objects: [
            createFieldObject('slippery-slope-field', GAME_CANVAS.height),
            createSurfaceObject({
                id: 'slippery-slope-left-wall-field',
                name: '왼쪽 벽 미끄럼 필드',
                x: WALL_THICKNESS - 7,
                y: fromBottom(GAME_CANVAS.height, 255),
                width: 260,
                height: 14,
                angle: 90,
                material: 'slippery',
            }),
            createSurfaceObject({
                id: 'slippery-slope-right-wall-field',
                name: '오른쪽 벽 미끄럼 필드',
                x: GAME_CANVAS.width - WALL_THICKNESS + 7,
                y: fromBottom(GAME_CANVAS.height, 255),
                width: 260,
                height: 14,
                angle: -90,
                material: 'slippery',
            }),
            createSurfaceObject({
                id: 'slippery-slope-l-overhang',
                name: 'ㄱ자 거꾸로 접면',
                x: GAME_CANVAS.width / 2,
                y: fromBottom(GAME_CANVAS.height, 240),
                width: 240,
                height: 22,
                angle: 180,
                surfaceSections: [
                    {
                        id: 'slippery-slope-l-overhang-center-ice',
                        name: 'ㄱ자 거꾸로 접면 중앙 미끄럼 구간',
                        startRatio: 0.42,
                        endRatio: 0.58,
                        material: 'slippery',
                    },
                ],
            }),
            createSurfaceObject({
                id: 'slippery-slope-left-wall-small-slope',
                name: '왼쪽 벽 바닥 연결 작은 경사면',
                x: WALL_THICKNESS + 50,
                y: fromBottom(GAME_CANVAS.height, 40),
                width: 100,
                height: 18,
                angle: 18,
                fillMode: 'solid-to-bottom',
            }),
            createSurfaceObject({
                id: 'slippery-slope-l-vertical',
                name: 'ㄱ자 오른쪽 세로 벽',
                x: GAME_CANVAS.width / 2 + 120,
                y: fromBottom(GAME_CANVAS.height, 140),
                width: 240,
                height: 22,
                angle: -90,
            }),
        ],
    },
} as const satisfies Record<string, LevelDefinition>;

export const getGimmickCaseLevel = (key: string | null): LevelDefinition => {
    if (key && key in GIMMICK_CASE_LEVELS) {
        return GIMMICK_CASE_LEVELS[key as keyof typeof GIMMICK_CASE_LEVELS];
    }

    return GIMMICK_CASE_LEVELS[DEFAULT_GIMMICK_CASE_KEY];
};
