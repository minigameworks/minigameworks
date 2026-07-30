import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';

export const GAME_CANVAS = {
    width: 960,
    height: 540,
} as const;

// 임시값: 최종 중력과 디버그 표시 정책은 게임플레이 명세에서 다시 결정한다.
const TEMPORARY_MATTER_GRAVITY_Y = 0.8;

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: 'app',
    width: GAME_CANVAS.width,
    height: GAME_CANVAS.height,
    backgroundColor: '#14213d',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: {
                x: 0,
                y: TEMPORARY_MATTER_GRAVITY_Y,
            },
            debug: true,
        },
    },
    scene: [BootScene],
};
