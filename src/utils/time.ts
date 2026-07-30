export function formatElapsedTime(totalMilliseconds: number): string {
    if (!Number.isFinite(totalMilliseconds) || totalMilliseconds < 0) {
        throw new Error('경과 시간은 0 이상의 유한한 숫자여야 한다.');
    }

    const minutes = Math.floor(totalMilliseconds / 60_000);
    const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
    const milliseconds = Math.floor(totalMilliseconds % 1_000);

    return `${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(milliseconds, 3)}`;
}

function pad(value: number, length: number): string {
    return String(value).padStart(length, '0');
}
