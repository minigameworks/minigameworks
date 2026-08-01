import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
    public constructor() {
        super('BootScene');
    }

    public create(): void {
        const caseKey = new URLSearchParams(window.location.search).get('case');

        if (caseKey !== null) {
            this.scene.start('PlayableCaseScene', { caseKey });
            return;
        }

        this.scene.start('GameScene');
    }
}
