import { describe, expect, it } from 'vitest';
import { GAME_CANVAS } from '../src/config/gameConstants';
import { createLevelFromTiledMap } from '../src/systems/TiledLevelLoader';
import type { TiledLevelMap } from '../src/systems/TiledLevelLoader';
import {
    DEFAULT_GIMMICK_CASE_KEY,
    getGimmickCaseLevel,
    getLevelField,
    getLevelSurfaceLineObjects,
    getLevelSurfaceObjects,
    getLevelTerrainObjects,
    PILLAR_GAP_CASE_KEY,
    SLIPPERY_SLOPE_CASE_KEY,
} from '../src/systems/LevelDefinitions';

describe('레벨 정의', () => {
    it('Tiled 초기 수직 맵은 내부 레벨 정의로 변환된다', () => {
        const level = createLevelFromTiledMap(createTiledLevelFixture());
        const field = getLevelField(level);
        const surfaceLineObjects = getLevelSurfaceLineObjects(level);
        const surfaceObjects = getLevelSurfaceObjects(level);
        const terrainObjects = getLevelTerrainObjects(level);

        expect(level.key).toBe('initial-vertical');
        expect(field.height).toBeGreaterThan(GAME_CANVAS.height);
        expect(level.startPosition.y).toBeGreaterThan(GAME_CANVAS.height);
        expect(terrainObjects).toHaveLength(1);
        expect(terrainObjects[0]?.tileSize).toBe(8);
        expect(terrainObjects[0]?.tiles.filter(Boolean)).toHaveLength(6);
        expect(surfaceObjects).toHaveLength(0);
        expect(surfaceLineObjects).toHaveLength(3);
        expect(surfaceLineObjects[0]?.id).toBe('surface-4');
        expect(surfaceLineObjects[0]?.start).toEqual({ x: 24, y: 1496 });
        expect(surfaceLineObjects[0]?.end).toEqual({ x: 128, y: 1596 });
        expect(surfaceLineObjects[0]?.normal.x).toBeCloseTo(0.69, 2);
        expect(surfaceLineObjects[0]?.normal.y).toBeCloseTo(-0.72, 2);
        expect(surfaceLineObjects[0]?.colliderVertices).toEqual([
            { x: 24, y: 1496 },
            { x: 128, y: 1596 },
            { x: 24, y: 1596 },
        ]);
        expect(surfaceLineObjects[1]?.id).toBe('surface-5-1');
        expect(surfaceLineObjects[1]?.start).toEqual({ x: 900, y: 1500 });
        expect(surfaceLineObjects[1]?.end).toEqual({ x: 936, y: 1500 });
        expect(surfaceLineObjects[1]?.normal).toEqual({ x: 0, y: -1 });
        expect(surfaceLineObjects[2]?.id).toBe('surface-5-2');
        expect(surfaceLineObjects[2]?.start).toEqual({ x: 900, y: 1596 });
        expect(surfaceLineObjects[2]?.end).toEqual({ x: 900, y: 1500 });
        expect(surfaceLineObjects[2]?.normal.x).toBeCloseTo(-1, 2);
    });

    it('기본 기믹 케이스 레벨을 조회할 수 있다', () => {
        const level = getGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);

        expect(level.key).toBe(DEFAULT_GIMMICK_CASE_KEY);
        expect(getLevelSurfaceObjects(level).length).toBeGreaterThan(0);
    });

    it('알 수 없는 케이스 키는 기본 케이스로 대체한다', () => {
        const level = getGimmickCaseLevel('unknown-case');

        expect(level.key).toBe(DEFAULT_GIMMICK_CASE_KEY);
    });

    it('레벨은 필드와 표면 오브젝트를 분리해 추적한다', () => {
        const level = getGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);

        expect(getLevelField(level).kind).toBe('field');
        expect(getLevelSurfaceObjects(level).every((object) => object.id.length > 0)).toBe(true);
    });

    it('메인 맵은 타일 지형과 접면선을 사용하고 기믹 케이스는 표면 오브젝트를 유지한다', () => {
        const mainTerrainObjects = getLevelTerrainObjects(
            createLevelFromTiledMap(createTiledLevelFixture()),
        );
        const mainSurfaceLineObjects = getLevelSurfaceLineObjects(
            createLevelFromTiledMap(createTiledLevelFixture()),
        );
        const caseSurfaceObjects = getLevelSurfaceObjects(
            getGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY),
        );

        expect(mainTerrainObjects.length).toBeGreaterThan(0);
        expect(mainSurfaceLineObjects.length).toBeGreaterThan(0);
        expect(caseSurfaceObjects.some((object) => object.fillMode === 'thin')).toBe(true);
    });

    it('기둥과 낭떠러지 케이스는 하단 채움 기둥과 끊긴 이동 구간을 가진다', () => {
        const level = getGimmickCaseLevel(PILLAR_GAP_CASE_KEY);
        const surfaceObjects = getLevelSurfaceObjects(level);

        expect(level.key).toBe(PILLAR_GAP_CASE_KEY);
        expect(
            surfaceObjects.filter((object) => object.fillMode === 'solid-to-bottom').length,
        ).toBeGreaterThanOrEqual(2);
        expect(surfaceObjects.some((object) => object.id === 'pillar-gap-risk-slope')).toBe(true);
    });

    it('미끄럼 표면 케이스는 벽 필드와 ㄱ자 미끄럼 구간을 가진다', () => {
        const level = getGimmickCaseLevel(SLIPPERY_SLOPE_CASE_KEY);
        const surfaceObjects = getLevelSurfaceObjects(level);
        const leftField = surfaceObjects.find(
            (object) => object.id === 'slippery-slope-left-wall-field',
        );
        const rightField = surfaceObjects.find(
            (object) => object.id === 'slippery-slope-right-wall-field',
        );
        const overhang = surfaceObjects.find((object) => object.id === 'slippery-slope-l-overhang');
        const leftWallSmallSlope = surfaceObjects.find(
            (object) => object.id === 'slippery-slope-left-wall-small-slope',
        );
        const vertical = surfaceObjects.find((object) => object.id === 'slippery-slope-l-vertical');

        expect(level.key).toBe(SLIPPERY_SLOPE_CASE_KEY);
        expect(leftField?.material).toBe('slippery');
        expect(leftField?.angle).toBe(90);
        expect(rightField?.material).toBe('slippery');
        expect(rightField?.angle).toBe(-90);
        expect(overhang?.material).toBe('default');
        expect(overhang?.angle).toBe(180);
        expect(
            overhang?.surfaceSections.some(
                (section) =>
                    section.material === 'slippery' &&
                    section.startRatio === 0.42 &&
                    section.endRatio === 0.58,
            ),
        ).toBe(true);
        expect(leftWallSmallSlope?.angle).toBe(18);
        expect(leftWallSmallSlope?.fillMode).toBe('solid-to-bottom');
        expect(vertical?.angle).toBe(-90);
    });

    it('플레이필드는 오브젝트 타입과 무관하게 공통 접면 edge를 생성한다', async () => {
        const level = getGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);
        const { Playfield } = await importPlayfield();
        const playfield = new Playfield({} as never, level);
        const edges = playfield.getSurfaceEdges();

        expect(edges.some((edge) => edge.id === 'slope-transfer-field-ground-top')).toBe(true);
        expect(edges.some((edge) => edge.id.startsWith('slope-transfer-entry-slope-top'))).toBe(
            true,
        );
        expect(edges.some((edge) => edge.id === 'slope-transfer-entry-slope-left-side')).toBe(true);
        expect(edges.every((edge) => edge.start && edge.end && edge.normal)).toBe(true);
    });

    it('플레이필드는 Tiled 접면선만 edge로 생성하고 terrain 타일 외곽선은 인식하지 않는다', async () => {
        const level = createLevelFromTiledMap(createTiledLevelFixture());
        const { Playfield } = await importPlayfield();
        const playfield = new Playfield({} as never, level);
        const edges = playfield.getSurfaceEdges();

        expect(edges.some((edge) => edge.id === 'surface-4')).toBe(true);
        expect(edges.some((edge) => edge.id.startsWith('initial-terrain-top-contour-'))).toBe(
            false,
        );
        expect(edges.some((edge) => edge.id.startsWith('initial-terrain-left-'))).toBe(false);
        expect(edges.some((edge) => edge.id.startsWith('initial-terrain-right-'))).toBe(false);
    });

    it('플레이필드는 terrain 도트 타일은 충돌 구현체로 만들지 않고 polygon surface만 충돌체로 만든다', async () => {
        const level = createLevelFromTiledMap(createTiledLevelFixture());
        const { Playfield } = await importPlayfield();
        const rectangleLabels: string[] = [];
        const polygonBodies: Array<{
            x: number;
            y: number;
            vertices: Array<{ x: number; y: number }>;
            label: string;
        }> = [];
        const playfield = new Playfield(
            {
                add: {
                    graphics: () => ({
                        fillStyle: () => undefined,
                        fillRect: () => undefined,
                    }),
                },
                matter: {
                    add: {
                        rectangle: (
                            _x: number,
                            _y: number,
                            _width: number,
                            _height: number,
                            options?: { label?: string },
                        ) => {
                            if (options?.label) {
                                rectangleLabels.push(options.label);
                            }

                            return {};
                        },
                        fromVertices: (
                            x: number,
                            y: number,
                            vertices: Array<{ x: number; y: number }>,
                            options?: { label?: string },
                        ) => {
                            if (options?.label) {
                                polygonBodies.push({ x, y, vertices, label: options.label });
                            }

                            return {};
                        },
                    },
                },
            } as never,
            level,
        );

        playfield.create();

        expect(rectangleLabels.some((label) => label === 'initial-terrain-terrain')).toBe(false);
        expect(rectangleLabels.some((label) => label === 'surface-4-solid-fill')).toBe(false);
        expect(polygonBodies.some((body) => body.label === 'surface-4-polygon')).toBe(true);
        expect(polygonBodies.some((body) => body.label === 'surface-5-1-polygon')).toBe(true);
        expect(polygonBodies.find((body) => body.label === 'surface-4-polygon')?.x).toBeCloseTo(
            58.67,
            2,
        );
        expect(polygonBodies.find((body) => body.label === 'surface-4-polygon')?.y).toBeCloseTo(
            1562.67,
            2,
        );
        expect(rectangleLabels.some((label) => label === 'fixture-field-ground')).toBe(true);
        expect(rectangleLabels.some((label) => label === 'fixture-field-left-wall')).toBe(true);
        expect(rectangleLabels.some((label) => label === 'fixture-field-right-wall')).toBe(true);
    });

    it('미끄럼 벽면 필드는 독립 edge 없이 기본 벽 edge에 material section을 만든다', async () => {
        const level = getGimmickCaseLevel(SLIPPERY_SLOPE_CASE_KEY);
        const { Playfield } = await importPlayfield();
        const playfield = new Playfield({} as never, level);
        const edges = playfield.getSurfaceEdges();
        const leftWallEdge = edges.find(
            (edge) => edge.id === 'slippery-slope-field-left-wall-inner',
        );
        const rightWallEdge = edges.find(
            (edge) => edge.id === 'slippery-slope-field-right-wall-inner',
        );

        expect(edges.some((edge) => edge.id.startsWith('slippery-slope-left-wall-field-'))).toBe(
            false,
        );
        expect(edges.some((edge) => edge.id.startsWith('slippery-slope-right-wall-field-'))).toBe(
            false,
        );
        expect(
            leftWallEdge?.materialSections.some((section) => section.material === 'slippery'),
        ).toBe(true);
        expect(
            rightWallEdge?.materialSections.some((section) => section.material === 'slippery'),
        ).toBe(true);
    });

    it('접면 normal 반대편의 내부 위치는 접면 후보로 인식하지 않는다', async () => {
        const level = getGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);
        const { Playfield } = await importPlayfield();
        const playfield = new Playfield({} as never, level);
        const edge = playfield
            .getSurfaceEdges()
            .find((surfaceEdge) => surfaceEdge.id.startsWith('slope-transfer-entry-slope-top'));

        expect(edge).toBeDefined();

        if (!edge) {
            return;
        }

        const insidePosition = {
            x: (edge.start.x + edge.end.x) / 2 - edge.normal.x * 24,
            y: (edge.start.y + edge.end.y) / 2 - edge.normal.y * 24,
        };
        const surfaces = playfield.getAttachmentSurfaces(
            insidePosition,
            {
                tangentHalfLength: 13,
                normalHalfDepth: 13,
            },
            18,
        );

        expect(surfaces.some((surface) => surface.edgeId === edge.id)).toBe(false);
    });

    it('Tiled 폴리곤 접면의 얕은 내부 접촉은 스냅 후보로 유지한다', async () => {
        const level = createLevelFromTiledMap(createTiledLevelFixture());
        const { Playfield } = await importPlayfield();
        const playfield = new Playfield({} as never, level);
        const edge = playfield
            .getSurfaceEdges()
            .find((surfaceEdge) => surfaceEdge.id === 'surface-4');

        expect(edge).toBeDefined();

        if (!edge) {
            return;
        }

        const insidePosition = {
            x: (edge.start.x + edge.end.x) / 2 - edge.normal.x * 8,
            y: (edge.start.y + edge.end.y) / 2 - edge.normal.y * 8,
        };
        const surfaces = playfield.getAttachmentSurfaces(
            insidePosition,
            {
                tangentHalfLength: 23,
                normalHalfDepth: 13,
            },
            18,
        );

        expect(surfaces.some((surface) => surface.edgeId === edge.id)).toBe(true);
    });

    it('접면 끝점에서 떨어진 위치는 스냅 후보로 인식하지 않는다', async () => {
        const level = getGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);
        const { Playfield } = await importPlayfield();
        const playfield = new Playfield({} as never, level);
        const edge = playfield
            .getSurfaceEdges()
            .find((surfaceEdge) => surfaceEdge.id.startsWith('slope-transfer-entry-slope-top'));

        expect(edge).toBeDefined();

        if (!edge) {
            return;
        }

        const tangent = {
            x: edge.end.x - edge.start.x,
            y: edge.end.y - edge.start.y,
        };
        const tangentLength = Math.hypot(tangent.x, tangent.y);
        const normalizedTangent = {
            x: tangent.x / tangentLength,
            y: tangent.y / tangentLength,
        };
        const detachedPosition = {
            x: edge.end.x + normalizedTangent.x * 24 + edge.normal.x * 13,
            y: edge.end.y + normalizedTangent.y * 24 + edge.normal.y * 13,
        };
        const surfaces = playfield.getAttachmentSurfaces(
            detachedPosition,
            {
                tangentHalfLength: 26,
                normalHalfDepth: 13,
            },
            18,
        );

        expect(surfaces.some((surface) => surface.edgeId === edge.id)).toBe(false);
    });

    it('접면 끝점 바로 근처도 모서리 전환 후보로 인식할 수 있다', async () => {
        const level = getGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);
        const { Playfield } = await importPlayfield();
        const playfield = new Playfield({} as never, level);
        const edge = playfield
            .getSurfaceEdges()
            .find((surfaceEdge) => surfaceEdge.id === 'slope-transfer-entry-slope-left-side');

        expect(edge).toBeDefined();

        if (!edge) {
            return;
        }

        const edgeVector = {
            x: edge.end.x - edge.start.x,
            y: edge.end.y - edge.start.y,
        };
        const edgeLength = Math.hypot(edgeVector.x, edgeVector.y);
        const tangent = {
            x: edgeVector.x / edgeLength,
            y: edgeVector.y / edgeLength,
        };
        const nearEndPosition = {
            x: edge.end.x - tangent.x * 4 + edge.normal.x * 13,
            y: edge.end.y - tangent.y * 4 + edge.normal.y * 13,
        };
        const surfaces = playfield.getAttachmentSurfaces(
            nearEndPosition,
            {
                tangentHalfLength: 23,
                normalHalfDepth: 13,
            },
            18,
        );

        expect(surfaces.some((surface) => surface.edgeId === edge.id)).toBe(true);
    });
});

const createTiledLevelFixture = (): TiledLevelMap => ({
    width: 60,
    height: 101,
    tilewidth: 8,
    tileheight: 8,
    layers: [
        {
            name: 'metadata',
            type: 'objectgroup',
            objects: [
                {
                    id: 1,
                    name: 'fixture-field',
                    type: 'field',
                    x: 0,
                    y: 0,
                    width: 960,
                    height: 1620,
                    properties: [
                        { name: 'levelKey', value: 'initial-vertical' },
                        { name: 'levelName', value: '초기 수직 맵' },
                        { name: 'wallThickness', value: 24 },
                    ],
                },
            ],
        },
        {
            name: 'markers',
            type: 'objectgroup',
            objects: [
                {
                    id: 2,
                    name: 'player-start',
                    type: 'playerStart',
                    x: 480,
                    y: 1583,
                },
            ],
        },
        {
            name: 'terrain',
            type: 'tilelayer',
            width: 4,
            height: 3,
            data: [1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0],
        },
        {
            name: 'surfaces',
            type: 'objectgroup',
            objects: [
                {
                    id: 4,
                    name: '',
                    type: 'surface',
                    x: 16,
                    y: 1496,
                    width: 0,
                    height: 0,
                    polygon: [
                        { x: 0, y: 0 },
                        { x: 112, y: 100 },
                        { x: 0, y: 100 },
                    ],
                },
                {
                    id: 5,
                    name: '',
                    type: '',
                    x: 900,
                    y: 1500,
                    width: 48,
                    height: 96,
                },
            ],
        },
    ],
});

const importPlayfield = async (): Promise<typeof import('../src/systems/Playfield')> =>
    import('../src/systems/Playfield');
