import Phaser from 'phaser';
import { GAME_CANVAS, TEMPORARY_SCENE_COLORS } from '../config/gameConfig';
import {
    getTemporaryLevelField,
    getTemporaryLevelSurfaceObjects,
    TemporaryFieldObjectDefinition,
    TemporaryLevelDefinition,
    TemporarySurfaceObjectDefinition,
} from './TemporaryLevelDefinitions';

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

type SegmentDefinition = {
    start: Phaser.Types.Math.Vector2Like;
    end: Phaser.Types.Math.Vector2Like;
    normal: Phaser.Types.Math.Vector2Like;
};

type SolidSurfacePolygon = [
    Phaser.Types.Math.Vector2Like,
    Phaser.Types.Math.Vector2Like,
    Phaser.Types.Math.Vector2Like,
    Phaser.Types.Math.Vector2Like,
];

export class TemporaryPlayfield {
    private readonly field: TemporaryFieldObjectDefinition;
    private readonly surfaceObjects: TemporarySurfaceObjectDefinition[];

    public constructor(
        private readonly scene: Phaser.Scene,
        private readonly level: TemporaryLevelDefinition,
    ) {
        this.field = getTemporaryLevelField(level);
        this.surfaceObjects = getTemporaryLevelSurfaceObjects(level);
    }

    public create(): void {
        const graphics = this.scene.add.graphics();
        const fieldX = this.getFieldX();
        const fieldY = this.getFieldY();
        const centerX = fieldX + this.field.width / 2;
        const groundY = this.getGroundTopY() + this.field.wallThickness / 2;
        const leftWallX = fieldX + this.field.wallThickness / 2;
        const rightWallX = fieldX + this.field.width - this.field.wallThickness / 2;
        const wallCenterY = fieldY + this.field.height / 2;

        graphics.fillStyle(TEMPORARY_SCENE_COLORS.background, 1);
        graphics.fillRect(0, fieldY, GAME_CANVAS.width, this.field.height);
        graphics.fillStyle(TEMPORARY_SCENE_COLORS.playfield, 1);
        graphics.fillRect(fieldX, fieldY, this.field.width, this.field.height);
        graphics.fillStyle(TEMPORARY_SCENE_COLORS.wall, 1);
        graphics.fillRect(fieldX, fieldY, this.field.wallThickness, this.field.height);
        graphics.fillRect(
            fieldX + this.field.width - this.field.wallThickness,
            fieldY,
            this.field.wallThickness,
            this.field.height,
        );
        graphics.fillStyle(TEMPORARY_SCENE_COLORS.ground, 1);
        graphics.fillRect(fieldX, this.getGroundTopY(), this.field.width, this.field.wallThickness);

        this.scene.matter.add.rectangle(
            centerX,
            groundY,
            this.field.width,
            this.field.wallThickness,
            {
                isStatic: true,
                label: `${this.field.id}-ground`,
            },
        );
        this.scene.matter.add.rectangle(
            leftWallX,
            wallCenterY,
            this.field.wallThickness,
            this.field.height,
            {
                isStatic: true,
                label: `${this.field.id}-left-wall`,
            },
        );
        this.scene.matter.add.rectangle(
            rightWallX,
            wallCenterY,
            this.field.wallThickness,
            this.field.height,
            {
                isStatic: true,
                label: `${this.field.id}-right-wall`,
            },
        );

        this.createTemporaryPlatforms(graphics);
    }

    private createTemporaryPlatforms(graphics: Phaser.GameObjects.Graphics): void {
        graphics.fillStyle(TEMPORARY_SCENE_COLORS.platform, 1);

        for (const platform of this.surfaceObjects) {
            if (platform.fillMode === 'solid-to-bottom') {
                this.createSolidSurfaceObject(graphics, platform);
            } else {
                this.createThinSurfaceObject(graphics, platform);
            }
        }
    }

    private createThinSurfaceObject(
        graphics: Phaser.GameObjects.Graphics,
        platform: TemporarySurfaceObjectDefinition,
    ): void {
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

        this.createThinSurfaceBody(platform);
    }

    private createThinSurfaceBody(platform: TemporarySurfaceObjectDefinition): void {
        this.scene.matter.add.rectangle(platform.x, platform.y, platform.width, platform.height, {
            isStatic: true,
            angle: Phaser.Math.DegToRad(platform.angle),
            label: platform.id,
        });
    }

    private createSolidSurfaceObject(
        graphics: Phaser.GameObjects.Graphics,
        platform: TemporarySurfaceObjectDefinition,
    ): void {
        const polygon = this.getSolidSurfacePolygon(platform);

        graphics.fillPoints(polygon, true);
        this.createThinSurfaceBody(platform);
        this.createSolidSurfaceSideBodies(platform);
    }

    private createSolidSurfaceSideBodies(platform: TemporarySurfaceObjectDefinition): void {
        const [topLeft, topRight] = this.getSolidSurfacePolygon(platform);

        this.createSolidSurfaceSideBody(`${platform.id}-left-side`, topLeft);
        this.createSolidSurfaceSideBody(`${platform.id}-right-side`, topRight);
    }

    private createSolidSurfaceSideBody(
        label: string,
        topPoint: Phaser.Types.Math.Vector2Like,
    ): void {
        const height = this.getGroundTopY() - topPoint.y;

        if (height <= 0) {
            return;
        }

        this.scene.matter.add.rectangle(topPoint.x, topPoint.y + height / 2, 2, height, {
            isStatic: true,
            label,
        });
    }

    public getSnailStartPosition(): Phaser.Types.Math.Vector2Like {
        return this.level.startPosition;
    }

    public getWorldWidth(): number {
        return this.field.width;
    }

    public getWorldHeight(): number {
        return this.field.height;
    }

    public getGroundTopY(): number {
        return this.getFieldY() + this.field.height - this.field.wallThickness;
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
        const leftWallRightX = fieldX + this.field.wallThickness;
        const rightWallLeftX = fieldX + this.field.width - this.field.wallThickness;

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

        for (const platform of this.surfaceObjects) {
            if (platform.fillMode === 'solid-to-bottom') {
                this.addSolidSurfaceAttachmentCandidates(
                    candidates,
                    position,
                    probe,
                    tolerance,
                    platform,
                );
                continue;
            }

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

    private addSolidSurfaceAttachmentCandidates(
        candidates: AttachmentCandidate[],
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
        platform: TemporarySurfaceObjectDefinition,
    ): void {
        this.addTopPlatformEdgeCandidate(candidates, position, probe, tolerance, platform);

        for (const segment of this.getSolidSurfaceSideSegments(platform)) {
            this.addSegmentAttachmentCandidate(candidates, position, probe, tolerance, segment);
        }
    }

    private addTopPlatformEdgeCandidate(
        candidates: AttachmentCandidate[],
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
        platform: TemporarySurfaceObjectDefinition,
    ): void {
        const angle = Phaser.Math.DegToRad(platform.angle);
        const localPosition = this.toLocalPlatformPoint(position, platform.x, platform.y, angle);
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

    private addSegmentAttachmentCandidate(
        candidates: AttachmentCandidate[],
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
        segment: SegmentDefinition,
    ): void {
        const segmentVector = {
            x: segment.end.x - segment.start.x,
            y: segment.end.y - segment.start.y,
        };
        const segmentLength = Math.hypot(segmentVector.x, segmentVector.y);

        if (segmentLength <= 0) {
            return;
        }

        const tangent = {
            x: segmentVector.x / segmentLength,
            y: segmentVector.y / segmentLength,
        };
        const delta = {
            x: position.x - segment.start.x,
            y: position.y - segment.start.y,
        };
        const tangentDistance = delta.x * tangent.x + delta.y * tangent.y;
        const normalDistance = delta.x * segment.normal.x + delta.y * segment.normal.y;
        const withinSpan =
            tangentDistance >= -probe.tangentHalfLength - tolerance &&
            tangentDistance <= segmentLength + probe.tangentHalfLength + tolerance;

        if (!withinSpan) {
            return;
        }

        const clampedTangentDistance = Phaser.Math.Clamp(tangentDistance, 0, segmentLength);
        const closestPoint = {
            x: segment.start.x + tangent.x * clampedTangentDistance,
            y: segment.start.y + tangent.y * clampedTangentDistance,
        };

        this.addAttachmentCandidate(
            candidates,
            Math.abs(normalDistance - probe.normalHalfDepth),
            tolerance,
            {
                normal: segment.normal,
                tangent,
                snapPosition: {
                    x: closestPoint.x + segment.normal.x * probe.normalHalfDepth,
                    y: closestPoint.y + segment.normal.y * probe.normalHalfDepth,
                },
            },
        );
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

    private getSolidSurfaceSideSegments(
        platform: TemporarySurfaceObjectDefinition,
    ): SegmentDefinition[] {
        const [topLeft, topRight, bottomRight, bottomLeft] = this.getSolidSurfacePolygon(platform);

        return [
            {
                start: bottomLeft,
                end: topLeft,
                normal: { x: -1, y: 0 },
            },
            {
                start: topRight,
                end: bottomRight,
                normal: { x: 1, y: 0 },
            },
        ];
    }

    private getSolidSurfacePolygon(
        platform: TemporarySurfaceObjectDefinition,
    ): SolidSurfacePolygon {
        const angle = Phaser.Math.DegToRad(platform.angle);
        const topLeft = this.toWorldPlatformPoint(
            { x: -platform.width / 2, y: -platform.height / 2 },
            platform,
            angle,
        );
        const topRight = this.toWorldPlatformPoint(
            { x: platform.width / 2, y: -platform.height / 2 },
            platform,
            angle,
        );
        const bottomY = this.getGroundTopY();

        const clampedTopLeft = this.clampSolidSurfacePointInsideField(topLeft);
        const clampedTopRight = this.clampSolidSurfacePointInsideField(topRight);

        return [
            clampedTopLeft,
            clampedTopRight,
            { x: clampedTopRight.x, y: bottomY },
            { x: clampedTopLeft.x, y: bottomY },
        ];
    }

    private clampSolidSurfacePointInsideField(
        point: Phaser.Types.Math.Vector2Like,
    ): Phaser.Types.Math.Vector2Like {
        const minX = this.getFieldX() + this.field.wallThickness;
        const maxX = this.getFieldX() + this.field.width - this.field.wallThickness;

        return {
            x: Phaser.Math.Clamp(point.x, minX, maxX),
            y: point.y,
        };
    }

    private toWorldPlatformPoint(
        localPoint: Phaser.Types.Math.Vector2Like,
        platform: TemporarySurfaceObjectDefinition,
        angle: number,
    ): Phaser.Types.Math.Vector2Like {
        const rotatedPoint = this.rotateVector(localPoint, angle);

        return {
            x: platform.x + rotatedPoint.x,
            y: platform.y + rotatedPoint.y,
        };
    }

    private getFieldX(): number {
        return (GAME_CANVAS.width - this.field.width) / 2;
    }

    private getFieldY(): number {
        return 0;
    }
}
