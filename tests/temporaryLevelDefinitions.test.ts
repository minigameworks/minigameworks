import { describe, expect, it } from 'vitest';
import { GAME_CANVAS } from '../src/config/gameConstants';
import {
    DEFAULT_GIMMICK_CASE_KEY,
    getTemporaryGimmickCaseLevel,
    getTemporaryLevelField,
    getTemporaryLevelSurfaceObjects,
    PILLAR_GAP_CASE_KEY,
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
});
