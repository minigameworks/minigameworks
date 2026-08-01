import Phaser from 'phaser';

export class SnailInputController {
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyA?: Phaser.Input.Keyboard.Key;
    private keyD?: Phaser.Input.Keyboard.Key;
    private keyW?: Phaser.Input.Keyboard.Key;
    private keyS?: Phaser.Input.Keyboard.Key;
    private shellKey?: Phaser.Input.Keyboard.Key;

    public constructor(private readonly scene: Phaser.Scene) {
        this.createKeys();
    }

    public getMoveDirection(): number {
        const isMovingLeft = Boolean(this.cursors?.left.isDown || this.keyA?.isDown);
        const isMovingRight = Boolean(this.cursors?.right.isDown || this.keyD?.isDown);

        if (isMovingLeft === isMovingRight) {
            return 0;
        }

        return isMovingLeft ? -1 : 1;
    }

    public getClimbDirection(): number {
        const isClimbingUp = Boolean(this.cursors?.up.isDown || this.keyW?.isDown);
        const isClimbingDown = Boolean(this.cursors?.down.isDown || this.keyS?.isDown);

        if (isClimbingUp === isClimbingDown) {
            return 0;
        }

        return isClimbingUp ? -1 : 1;
    }

    public isShellToggleJustDown(): boolean {
        return Boolean(this.shellKey && Phaser.Input.Keyboard.JustDown(this.shellKey));
    }

    public isJumpJustDown(): boolean {
        return Boolean(
            (this.cursors?.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
            (this.keyW && Phaser.Input.Keyboard.JustDown(this.keyW)),
        );
    }

    private createKeys(): void {
        if (!this.scene.input.keyboard) {
            return;
        }

        this.scene.input.keyboard.addCapture([
            Phaser.Input.Keyboard.KeyCodes.LEFT,
            Phaser.Input.Keyboard.KeyCodes.RIGHT,
            Phaser.Input.Keyboard.KeyCodes.UP,
            Phaser.Input.Keyboard.KeyCodes.DOWN,
            Phaser.Input.Keyboard.KeyCodes.SPACE,
            Phaser.Input.Keyboard.KeyCodes.A,
            Phaser.Input.Keyboard.KeyCodes.D,
            Phaser.Input.Keyboard.KeyCodes.W,
            Phaser.Input.Keyboard.KeyCodes.S,
        ]);
        this.cursors = this.scene.input.keyboard.createCursorKeys();
        this.keyA = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyW = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyS = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.shellKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
}
