import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { GameScene } from '../scenes/GameScene';
import { PlayableCaseScene } from '../scenes/PlayableCaseScene';
import { GAME_BACKGROUND_COLOR, GAME_CANVAS, GAME_PARENT_ID, MATTER_CONFIG } from './gameConstants';

export * from './gameConstants';

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: GAME_PARENT_ID,
    width: GAME_CANVAS.width,
    height: GAME_CANVAS.height,
    backgroundColor: GAME_BACKGROUND_COLOR,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'matter',
        matter: {
            gravity: {
                x: MATTER_CONFIG.gravity.x,
                y: MATTER_CONFIG.gravity.y,
            },
            debug: MATTER_CONFIG.debug,
        },
    },
    scene: [BootScene, GameScene, PlayableCaseScene],
};
