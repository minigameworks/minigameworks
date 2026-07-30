import Phaser from 'phaser';
import {
    GAME_CANVAS,
    TEMPORARY_PLATFORMS,
    TEMPORARY_PLAYFIELD,
    TEMPORARY_SCENE_COLORS,
    TEMPORARY_SNAIL_MARKER,
} from '../config/gameConfig';

export type AttachmentSurface = {
    normal: Phaser.Types.Math.Vector2Like;
    tangent: Phaser.Types.Math.Vector2Like;
    snapPosition: Phaser.Types.Math.Vector2Like;
};

export type AttachmentProbe = {
    tangentHalfLength: number;
    normalHalfDepth: number;
};

type AttachmentCandidate = {
    distance: number;
    surface: AttachmentSurface;
};

export class TemporaryPlayfield {
    public constructor(private readonly scene: Phaser.Scene) {}

    public create(): void {
        const graphics = this.scene.add.graphics();
        const fieldX = this.getFieldX();
        const fieldY = this.getFieldY();
        const centerX = GAME_CANVAS.width / 2;
        const groundY = this.getGroundTopY() + TEMPORARY_PLAYFIELD.wallThickness / 2;
        const leftWallX = fieldX + TEMPORARY_PLAYFIELD.wallThickness / 2;
        const rightWallX =
            fieldX + TEMPORARY_PLAYFIELD.width - TEMPORARY_PLAYFIELD.wallThickness / 2;
        const wallCenterY = fieldY + TEMPORARY_PLAYFIELD.height / 2;

        graphics.fillStyle(TEMPORARY_SCENE_COLORS.background, 1);
        graphics.fillRect(0, fieldY, GAME_CANVAS.width, TEMPORARY_PLAYFIELD.height);
        graphics.fillStyle(TEMPORARY_SCENE_COLORS.playfield, 1);
        graphics.fillRect(fieldX, fieldY, TEMPORARY_PLAYFIELD.width, TEMPORARY_PLAYFIELD.height);
        graphics.fillStyle(TEMPORARY_SCENE_COLORS.wall, 1);
        graphics.fillRect(
            fieldX,
            fieldY,
            TEMPORARY_PLAYFIELD.wallThickness,
            TEMPORARY_PLAYFIELD.height,
        );
        graphics.fillRect(
            fieldX + TEMPORARY_PLAYFIELD.width - TEMPORARY_PLAYFIELD.wallThickness,
            fieldY,
            TEMPORARY_PLAYFIELD.wallThickness,
            TEMPORARY_PLAYFIELD.height,
        );
        graphics.fillStyle(TEMPORARY_SCENE_COLORS.ground, 1);
        graphics.fillRect(
            fieldX,
            this.getGroundTopY(),
            TEMPORARY_PLAYFIELD.width,
            TEMPORARY_PLAYFIELD.wallThickness,
        );

        this.scene.matter.add.rectangle(
            centerX,
            groundY,
            TEMPORARY_PLAYFIELD.width,
            TEMPORARY_PLAYFIELD.wallThickness,
            {
                isStatic: true,
                label: 'temporary-ground',
            },
        );
        this.scene.matter.add.rectangle(
            leftWallX,
            wallCenterY,
            TEMPORARY_PLAYFIELD.wallThickness,
            TEMPORARY_PLAYFIELD.height,
            {
                isStatic: true,
                label: 'temporary-left-wall',
            },
        );
        this.scene.matter.add.rectangle(
            rightWallX,
            wallCenterY,
            TEMPORARY_PLAYFIELD.wallThickness,
            TEMPORARY_PLAYFIELD.height,
            {
                isStatic: true,
                label: 'temporary-right-wall',
            },
        );

        this.createTemporaryPlatforms(graphics);
    }

    private createTemporaryPlatforms(graphics: Phaser.GameObjects.Graphics): void {
        graphics.fillStyle(TEMPORARY_SCENE_COLORS.platform, 1);

        for (const platform of TEMPORARY_PLATFORMS) {
            graphics.save();
            graphics.translateCanvas(platform.x, platform.y);
            graphics.rotateCanvas(Phaser.Math.DegToRad(platform.angle));
            graphics.fillRect(
                -platform.width / 2,
                -platform.height / 2,
                platform.width,
                platform.height,
            );
            graphics.restore();

            this.scene.matter.add.rectangle(
                platform.x,
                platform.y,
                platform.width,
                platform.height,
                {
                    isStatic: true,
                    angle: Phaser.Math.DegToRad(platform.angle),
                    label: 'temporary-platform',
                },
            );
        }
    }

    public getSnailStartPosition(): Phaser.Types.Math.Vector2Like {
        return {
            x: GAME_CANVAS.width / 2,
            y: this.getGroundTopY() - TEMPORARY_SNAIL_MARKER.normalSegmentRadius,
        };
    }

    public getGroundTopY(): number {
        return this.getFieldY() + TEMPORARY_PLAYFIELD.height - TEMPORARY_PLAYFIELD.wallThickness;
    }

    public getAttachmentSurface(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentSurface | undefined {
        return this.getAttachmentSurfaces(position, probe, tolerance)[0];
    }

    public getAttachmentSurfaces(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentSurface[] {
        const candidates = [
            ...this.getBoundaryAttachmentCandidates(position, probe, tolerance),
            ...this.getPlatformAttachmentCandidates(position, probe, tolerance),
        ];

        return candidates
            .sort((a, b) => a.distance - b.distance)
            .map((candidate) => candidate.surface);
    }

    public getSupportingAttachmentSurface(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentSurface | undefined {
        return this.getAttachmentSurfaces(position, probe, tolerance).find(
            (surface) => surface.normal.y < -0.2,
        );
    }

    private getBoundaryAttachmentCandidates(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentCandidate[] {
        const candidates: AttachmentCandidate[] = [];
        const groundTopY = this.getGroundTopY();

        this.addAttachmentCandidate(
            candidates,
            Math.abs(position.y + probe.normalHalfDepth - groundTopY),
            tolerance,
            {
                normal: { x: 0, y: -1 },
                tangent: { x: 1, y: 0 },
                snapPosition: { x: position.x, y: groundTopY - probe.normalHalfDepth },
            },
        );
        candidates.push(...this.getWallAttachmentCandidates(position, probe, tolerance));

        return candidates;
    }

    private getWallAttachmentCandidates(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentCandidate[] {
        const candidates: AttachmentCandidate[] = [];
        const fieldX = this.getFieldX();
        const leftWallRightX = fieldX + TEMPORARY_PLAYFIELD.wallThickness;
        const rightWallLeftX =
            fieldX + TEMPORARY_PLAYFIELD.width - TEMPORARY_PLAYFIELD.wallThickness;

        this.addAttachmentCandidate(
            candidates,
            Math.abs(position.x - probe.normalHalfDepth - leftWallRightX),
            tolerance,
            {
                normal: { x: 1, y: 0 },
                tangent: { x: 0, y: -1 },
                snapPosition: { x: leftWallRightX + probe.normalHalfDepth, y: position.y },
            },
        );
        this.addAttachmentCandidate(
            candidates,
            Math.abs(position.x + probe.normalHalfDepth - rightWallLeftX),
            tolerance,
            {
                normal: { x: -1, y: 0 },
                tangent: { x: 0, y: -1 },
                snapPosition: { x: rightWallLeftX - probe.normalHalfDepth, y: position.y },
            },
        );

        return candidates;
    }

    private getPlatformAttachmentCandidates(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentCandidate[] {
        const candidates: AttachmentCandidate[] = [];

        for (const platform of TEMPORARY_PLATFORMS) {
            const angle = Phaser.Math.DegToRad(platform.angle);
            const localPosition = this.toLocalPlatformPoint(
                position,
                platform.x,
                platform.y,
                angle,
            );
            const halfWidth = platform.width / 2;
            const halfHeight = platform.height / 2;

            this.addPlatformEdgeCandidate(candidates, {
                localPosition,
                angle,
                platformPosition: {
                    x: platform.x,
                    y: platform.y,
                },
                distance: Math.abs(localPosition.y + halfHeight + probe.normalHalfDepth),
                withinSpan:
                    Math.abs(localPosition.x) <= halfWidth + probe.tangentHalfLength + tolerance,
                tolerance,
                localNormal: { x: 0, y: -1 },
                localSnapPosition: {
                    x: localPosition.x,
                    y: -halfHeight - probe.normalHalfDepth,
                },
            });
            this.addPlatformEdgeCandidate(candidates, {
                localPosition,
                angle,
                platformPosition: {
                    x: platform.x,
                    y: platform.y,
                },
                distance: Math.abs(localPosition.y - halfHeight - probe.normalHalfDepth),
                withinSpan:
                    Math.abs(localPosition.x) <= halfWidth + probe.tangentHalfLength + tolerance,
                tolerance,
                localNormal: { x: 0, y: 1 },
                localSnapPosition: {
                    x: localPosition.x,
                    y: halfHeight + probe.normalHalfDepth,
                },
            });
            this.addPlatformEdgeCandidate(candidates, {
                localPosition,
                angle,
                platformPosition: {
                    x: platform.x,
                    y: platform.y,
                },
                distance: Math.abs(localPosition.x + halfWidth + probe.normalHalfDepth),
                withinSpan:
                    Math.abs(localPosition.y) <= halfHeight + probe.tangentHalfLength + tolerance,
                tolerance,
                localNormal: { x: -1, y: 0 },
                localSnapPosition: {
                    x: -halfWidth - probe.normalHalfDepth,
                    y: localPosition.y,
                },
            });
            this.addPlatformEdgeCandidate(candidates, {
                localPosition,
                angle,
                platformPosition: {
                    x: platform.x,
                    y: platform.y,
                },
                distance: Math.abs(localPosition.x - halfWidth - probe.normalHalfDepth),
                withinSpan:
                    Math.abs(localPosition.y) <= halfHeight + probe.tangentHalfLength + tolerance,
                tolerance,
                localNormal: { x: 1, y: 0 },
                localSnapPosition: {
                    x: halfWidth + probe.normalHalfDepth,
                    y: localPosition.y,
                },
            });
        }

        return candidates;
    }

    private addPlatformEdgeCandidate(
        candidates: AttachmentCandidate[],
        options: {
            localPosition: Phaser.Types.Math.Vector2Like;
            angle: number;
            platformPosition: Phaser.Types.Math.Vector2Like;
            distance: number;
            withinSpan: boolean;
            tolerance: number;
            localNormal: Phaser.Types.Math.Vector2Like;
            localSnapPosition: Phaser.Types.Math.Vector2Like;
        },
    ): void {
        if (!options.withinSpan) {
            return;
        }

        const normal = this.rotateVector(options.localNormal, options.angle);
        const tangent = {
            x: -normal.y,
            y: normal.x,
        };
        const snapOffset = this.rotateVector(options.localSnapPosition, options.angle);

        this.addAttachmentCandidate(candidates, options.distance, options.tolerance, {
            normal,
            tangent,
            snapPosition: {
                x: options.platformPosition.x + snapOffset.x,
                y: options.platformPosition.y + snapOffset.y,
            },
        });
    }

    private addAttachmentCandidate(
        candidates: AttachmentCandidate[],
        distance: number,
        tolerance: number,
        surface: AttachmentSurface,
    ): void {
        if (distance <= tolerance) {
            candidates.push({ distance, surface });
        }
    }

    private toLocalPlatformPoint(
        point: Phaser.Types.Math.Vector2Like,
        centerX: number,
        centerY: number,
        angle: number,
    ): Phaser.Types.Math.Vector2Like {
        const dx = point.x - centerX;
        const dy = point.y - centerY;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);

        return {
            x: dx * cos - dy * sin,
            y: dx * sin + dy * cos,
        };
    }

    private rotateVector(
        vector: Phaser.Types.Math.Vector2Like,
        angle: number,
    ): Phaser.Types.Math.Vector2Like {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return {
            x: vector.x * cos - vector.y * sin,
            y: vector.x * sin + vector.y * cos,
        };
    }

    private getFieldX(): number {
        return (GAME_CANVAS.width - TEMPORARY_PLAYFIELD.width) / 2;
    }

    private getFieldY(): number {
        return (GAME_CANVAS.height - TEMPORARY_PLAYFIELD.height) / 2;
    }
}
