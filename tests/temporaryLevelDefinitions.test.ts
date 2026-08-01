import { describe, expect, it } from 'vitest';
import { GAME_CANVAS } from '../src/config/gameConstants';
import {
    DEFAULT_GIMMICK_CASE_KEY,
    getTemporaryGimmickCaseLevel,
    TEMPORARY_MAIN_LEVEL,
} from '../src/systems/TemporaryLevelDefinitions';

describe('임시 레벨 정의', () => {
    it('메인 수직 레벨은 화면보다 위로 확장된다', () => {
        expect(TEMPORARY_MAIN_LEVEL.world.height).toBeGreaterThan(GAME_CANVAS.height);
        expect(TEMPORARY_MAIN_LEVEL.startPosition.y).toBeGreaterThan(GAME_CANVAS.height);
    });

    it('기본 기믹 케이스 레벨을 조회할 수 있다', () => {
        const level = getTemporaryGimmickCaseLevel(DEFAULT_GIMMICK_CASE_KEY);

        expect(level.key).toBe(DEFAULT_GIMMICK_CASE_KEY);
        expect(level.platforms.length).toBeGreaterThan(0);
    });

    it('알 수 없는 케이스 키는 기본 케이스로 대체한다', () => {
        const level = getTemporaryGimmickCaseLevel('unknown-case');

        expect(level.key).toBe(DEFAULT_GIMMICK_CASE_KEY);
    });
});
