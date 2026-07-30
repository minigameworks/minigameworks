import { describe, expect, it } from 'vitest';
import { formatElapsedTime } from '../src/utils/time';

describe('formatElapsedTime', () => {
    it('밀리초를 분, 초, 밀리초 형식으로 변환한다', () => {
        expect(formatElapsedTime(65_432)).toBe('01:05.432');
    });

    it('0초 기록을 고정된 자리수로 표시한다', () => {
        expect(formatElapsedTime(0)).toBe('00:00.000');
    });

    it('음수 시간은 허용하지 않는다', () => {
        expect(() => formatElapsedTime(-1)).toThrow('경과 시간');
    });
});
