import { describe, expect, it } from 'vitest';
import { GAME_CANVAS } from '../src/config/gameConstants';
import {
    DEFAULT_GIMMICK_CASE_KEY,
    getTemporaryGimmickCaseLevel,
    getTemporaryLevelField,
    getTemporaryLevelSurfaceObjects,
    PILLAR_GAP_CASE_KEY,
    SLIPPERY_SLOPE_CASE_KEY,
    TEMPORARY_MAIN_LEVEL,
} from '../src/systems/TemporaryLevelDefinitions';

describe('임시 레벨 정의', () => {
    it('메인 수직 레벨은 화면보다 위로 확장된다', () => {
        expect(getTemporaryLevelField(TEMPORARY_MAIN_LEVEL).height).toBeGreaterThan(
            GAME_CANVAS.height,
        );
        expect(TEMPORARY_MAIN_LEVEL.startPosition.y).toBeGreaterThan(GAME_CANVAS.height);
    });

    it('기본 기믹 케이스 레벨을 조회할 수 있다', () => {
        const level = getTemporaryGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);

        expect(level.key).toBe(DEFAULT_GIMMICK_CASE_KEY);
        expect(getTemporaryLevelSurfaceObjects(level).length).toBeGreaterThan(0);
    });

    it('알 수 없는 케이스 키는 기본 케이스로 대체한다', () => {
        const level = getTemporaryGimmickCaseLevel('unknown-case');

        expect(level.key).toBe(DEFAULT_GIMMICK_CASE_KEY);
    });

    it('레벨은 필드와 표면 오브젝트를 분리해 추적한다', () => {
        const level = getTemporaryGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);

        expect(getTemporaryLevelField(level).kind).toBe('field');
        expect(getTemporaryLevelSurfaceObjects(level).every((object) => object.id.length > 0)).toBe(
            true,
        );
    });

    it('표면 오브젝트는 얇은 형태와 하단 채움 형태를 구분한다', () => {
        const mainSurfaceObjects = getTemporaryLevelSurfaceObjects(TEMPORARY_MAIN_LEVEL);
        const caseSurfaceObjects = getTemporaryLevelSurfaceObjects(
            getTemporaryGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY),
        );

        expect(mainSurfaceObjects.some((object) => object.fillMode === 'solid-to-bottom')).toBe(
            true,
        );
        expect(caseSurfaceObjects.some((object) => object.fillMode === 'thin')).toBe(true);
    });

    it('기둥과 낭떠러지 케이스는 하단 채움 기둥과 끊긴 이동 구간을 가진다', () => {
        const level = getTemporaryGimmickCaseLevel(PILLAR_GAP_CASE_KEY);
        const surfaceObjects = getTemporaryLevelSurfaceObjects(level);

        expect(level.key).toBe(PILLAR_GAP_CASE_KEY);
        expect(
            surfaceObjects.filter((object) => object.fillMode === 'solid-to-bottom').length,
        ).toBeGreaterThanOrEqual(2);
        expect(surfaceObjects.some((object) => object.id === 'pillar-gap-risk-slope')).toBe(true);
    });

    it('미끄럼 표면 케이스는 벽 필드와 ㄱ자 미끄럼 구간을 가진다', () => {
        const level = getTemporaryGimmickCaseLevel(SLIPPERY_SLOPE_CASE_KEY);
        const surfaceObjects = getTemporaryLevelSurfaceObjects(level);
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
        const level = getTemporaryGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);
        const { TemporaryPlayfield } = await importTemporaryPlayfield();
        const playfield = new TemporaryPlayfield({} as never, level);
        const edges = playfield.getSurfaceEdges();

        expect(edges.some((edge) => edge.id === 'slope-transfer-field-ground-top')).toBe(true);
        expect(edges.some((edge) => edge.id.startsWith('slope-transfer-entry-slope-top'))).toBe(
            true,
        );
        expect(edges.some((edge) => edge.id === 'slope-transfer-entry-slope-left-side')).toBe(true);
        expect(edges.every((edge) => edge.start && edge.end && edge.normal)).toBe(true);
    });

    it('미끄럼 벽면 필드는 독립 edge 없이 기본 벽 edge에 material section을 만든다', async () => {
        const level = getTemporaryGimmickCaseLevel(SLIPPERY_SLOPE_CASE_KEY);
        const { TemporaryPlayfield } = await importTemporaryPlayfield();
        const playfield = new TemporaryPlayfield({} as never, level);
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
        const level = getTemporaryGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);
        const { TemporaryPlayfield } = await importTemporaryPlayfield();
        const playfield = new TemporaryPlayfield({} as never, level);
        const edge = playfield
            .getSurfaceEdges()
            .find((surfaceEdge) => surfaceEdge.id.startsWith('slope-transfer-entry-slope-top'));

        expect(edge).toBeDefined();

        if (!edge) {
            return;
        }

        const insidePosition = {
            x: (edge.start.x + edge.end.x) / 2 - edge.normal.x * 5,
            y: (edge.start.y + edge.end.y) / 2 - edge.normal.y * 5,
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

    it('접면 끝점에서 떨어진 위치는 스냅 후보로 인식하지 않는다', async () => {
        const level = getTemporaryGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);
        const { TemporaryPlayfield } = await importTemporaryPlayfield();
        const playfield = new TemporaryPlayfield({} as never, level);
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
        const level = getTemporaryGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);
        const { TemporaryPlayfield } = await importTemporaryPlayfield();
        const playfield = new TemporaryPlayfield({} as never, level);
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

const importTemporaryPlayfield = async (): Promise<
    typeof import('../src/systems/TemporaryPlayfield')
> => import('../src/systems/TemporaryPlayfield');
