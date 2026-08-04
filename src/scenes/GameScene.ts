import Phaser from 'phaser';
import { GAME_CANVAS } from '../config/gameConfig';
import { SnailPlayer } from '../entities/SnailPlayer';
import {
    createLevelFromTiledMap,
    INITIAL_VERTICAL_MAP_KEY,
    INITIAL_VERTICAL_MAP_PATH,
} from '../systems/TiledLevelLoader';
import type { TiledLevelMap } from '../systems/TiledLevelLoader';
import { Playfield } from '../systems/Playfield';

export class GameScene extends Phaser.Scene {
    private playfield?: Playfield;
    private player?: SnailPlayer;
    private followedTarget?: Phaser.GameObjects.GameObject;

    public constructor() {
        super('GameScene');
    }

    public preload(): void {
        this.load.json(INITIAL_VERTICAL_MAP_KEY, INITIAL_VERTICAL_MAP_PATH);
    }

    public create(): void {
        const map = this.cache.json.get(INITIAL_VERTICAL_MAP_KEY) as TiledLevelMap;
        const level = createLevelFromTiledMap(map);

        this.playfield = new Playfield(this, level);
        this.playfield.create();

        this.player = new SnailPlayer(this, this.playfield, this.playfield.getSnailStartPosition());
        this.configureVerticalWorld();
    }

    public update(): void {
        this.player?.update();
        this.syncCameraFollowTarget();
    }

    private configureVerticalWorld(): void {
        if (!this.playfield || !this.player) {
            return;
        }

        this.matter.world.setBounds(
            0,
            0,
            this.playfield.getWorldWidth(),
            this.playfield.getWorldHeight(),
        );
        this.cameras.main.setBounds(
            0,
            0,
            this.playfield.getWorldWidth(),
            this.playfield.getWorldHeight(),
        );
        this.cameras.main.startFollow(this.player.getGameObject(), true, 0.08, 0.08);
        this.followedTarget = this.player.getGameObject();
        this.cameras.main.setScroll(0, this.playfield.getWorldHeight() - GAME_CANVAS.height);
    }

    private syncCameraFollowTarget(): void {
        if (!this.player) {
            return;
        }

        const currentTarget = this.player.getGameObject();

        if (currentTarget === this.followedTarget) {
            return;
        }

        this.cameras.main.startFollow(currentTarget, true, 0.08, 0.08);
        this.followedTarget = currentTarget;
    }
}
