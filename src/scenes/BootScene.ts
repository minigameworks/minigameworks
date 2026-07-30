import Phaser from 'phaser';
import { GAME_CANVAS } from '../config/gameConfig';

export class BootScene extends Phaser.Scene {
    public constructor() {
        super('BootScene');
    }

    public create(): void {
        this.createPlaceholderCliff();
        this.createTemporarySnailMarker();
        this.createHudText();
    }

    private createPlaceholderCliff(): void {
        const graphics = this.add.graphics();

        graphics.fillStyle(0x2f3e46, 1);
        graphics.fillRect(0, 0, GAME_CANVAS.width, GAME_CANVAS.height);
        graphics.fillStyle(0x52796f, 1);
        graphics.fillRect(660, 48, 120, 440);
        graphics.fillStyle(0x84a98c, 1);
        graphics.fillRect(600, 420, 240, 32);

        this.matter.add.rectangle(720, 436, 240, 32, {
            isStatic: true,
            label: 'temporary-ground',
        });
        this.matter.add.rectangle(720, 268, 120, 440, {
            isStatic: true,
            label: 'temporary-cliff',
        });
    }

    private createTemporarySnailMarker(): void {
        const marker = this.add.circle(520, 340, 22, 0xf4d35e);

        this.matter.add.gameObject(marker, {
            label: 'temporary-snail-marker',
            shape: {
                type: 'circle',
                radius: 22,
            },
            restitution: 0.2,
        });
    }

    private createHudText(): void {
        this.add
            .text(32, 28, '달팽이 클라이밍 프로토타입', {
                fontFamily: 'sans-serif',
                fontSize: '28px',
                color: '#f8f9fa',
            })
            .setScrollFactor(0);

        this.add
            .text(32, 68, 'Matter Physics 연결 확인용 최소 Scene', {
                fontFamily: 'sans-serif',
                fontSize: '16px',
                color: '#d9ed92',
            })
            .setScrollFactor(0);
    }
}
