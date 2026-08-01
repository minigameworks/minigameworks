import Phaser from 'phaser';
import { GAME_CANVAS } from '../config/gameConfig';
import { SnailPlayer } from '../entities/SnailPlayer';
import { TemporaryPlayfield } from '../systems/TemporaryPlayfield';
import { getTemporaryGimmickCaseLevel } from '../systems/TemporaryLevelDefinitions';

type PlayableCaseSceneData = {
    caseKey?: string;
};

export class PlayableCaseScene extends Phaser.Scene {
    private playfield?: TemporaryPlayfield;
    private player?: SnailPlayer;
    private followedTarget?: Phaser.GameObjects.GameObject;

    public constructor() {
        super('PlayableCaseScene');
    }

    public create(data: PlayableCaseSceneData): void {
        const level = getTemporaryGimmickCaseLevel(data.caseKey ?? null);

        this.playfield = new TemporaryPlayfield(this, level);
        this.playfield.create();

        this.player = new SnailPlayer(this, this.playfield, this.playfield.getSnailStartPosition());
        this.configureCaseWorld();
    }

    public update(): void {
        this.player?.update();
        this.syncCameraFollowTarget();
    }

    private configureCaseWorld(): void {
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
        this.cameras.main.setScroll(
            0,
            Math.max(0, this.playfield.getWorldHeight() - GAME_CANVAS.height),
        );
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
