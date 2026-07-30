import Phaser from 'phaser';
import { GAME_CANVAS, TEMPORARY_PLAYFIELD } from '../config/gameConfig';
import { SnailPlayer } from '../entities/SnailPlayer';
import { TemporaryPlayfield } from '../systems/TemporaryPlayfield';

export class GameScene extends Phaser.Scene {
    private playfield?: TemporaryPlayfield;
    private player?: SnailPlayer;

    public constructor() {
        super('GameScene');
    }

    public create(): void {
        this.playfield = new TemporaryPlayfield(this);
        this.playfield.create();

        this.player = new SnailPlayer(this, this.playfield, this.playfield.getSnailStartPosition());
        this.configureVerticalWorld();
    }

    public update(): void {
        this.player?.update();
    }

    private configureVerticalWorld(): void {
        this.matter.world.setBounds(0, 0, GAME_CANVAS.width, TEMPORARY_PLAYFIELD.height);
        this.cameras.main.setBounds(0, 0, GAME_CANVAS.width, TEMPORARY_PLAYFIELD.height);
        this.cameras.main.setScroll(0, 0);
    }
}
