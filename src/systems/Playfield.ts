import type Phaser from 'phaser';
import { GAME_CANVAS, SCENE_COLORS } from '../config/gameConstants';
import {
    getLevelField,
    getLevelSurfaceLineObjects,
    getLevelSurfaceObjects,
    getLevelTerrainObjects,
    FieldObjectDefinition,
    LevelDefinition,
    SurfaceLineObjectDefinition,
    SurfaceObjectDefinition,
    SurfaceMaterial,
    SurfaceMaterialSection,
    TerrainObjectDefinition,
} from './LevelDefinitions';

export type AttachmentSurface = {
    edgeId: string;
    start: Phaser.Types.Math.Vector2Like;
    end: Phaser.Types.Math.Vector2Like;
    normal: Phaser.Types.Math.Vector2Like;
    tangent: Phaser.Types.Math.Vector2Like;
    snapPosition: Phaser.Types.Math.Vector2Like;
    progress: number;
    length: number;
    material: SurfaceMaterial;
};

export type AttachmentProbe = {
    tangentHalfLength: number;
    normalHalfDepth: number;
};

type AttachmentCandidate = {
    distance: number;
    surface: AttachmentSurface;
};

export type SurfaceEdge = {
    id: string;
    start: Phaser.Types.Math.Vector2Like;
    end: Phaser.Types.Math.Vector2Like;
    normal: Phaser.Types.Math.Vector2Like;
    material: SurfaceMaterial;
    materialSections: SurfaceMaterialSection[];
};

type SolidSurfacePolygon = [
    Phaser.Types.Math.Vector2Like,
    Phaser.Types.Math.Vector2Like,
    Phaser.Types.Math.Vector2Like,
    Phaser.Types.Math.Vector2Like,
];

type TerrainHorizontalRun = {
    row: number;
    column: number;
    length: number;
};

export class Playfield {
    private readonly field: FieldObjectDefinition;
    private readonly surfaceObjects: SurfaceObjectDefinition[];
    private readonly surfaceLineObjects: SurfaceLineObjectDefinition[];
    private readonly terrainObjects: TerrainObjectDefinition[];
    private readonly surfaceEdges: SurfaceEdge[];

    public constructor(
        private readonly scene: Phaser.Scene,
        private readonly level: LevelDefinition,
    ) {
        this.field = getLevelField(level);
        this.surfaceObjects = getLevelSurfaceObjects(level);
        this.surfaceLineObjects = getLevelSurfaceLineObjects(level);
        this.terrainObjects = getLevelTerrainObjects(level);
        this.surfaceEdges = this.createSurfaceEdges();
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

        graphics.fillStyle(SCENE_COLORS.background, 1);
        graphics.fillRect(0, fieldY, GAME_CANVAS.width, this.field.height);
        graphics.fillStyle(SCENE_COLORS.playfield, 1);
        graphics.fillRect(fieldX, fieldY, this.field.width, this.field.height);
        graphics.fillStyle(SCENE_COLORS.wall, 1);
        graphics.fillRect(fieldX, fieldY, this.field.wallThickness, this.field.height);
        graphics.fillRect(
            fieldX + this.field.width - this.field.wallThickness,
            fieldY,
            this.field.wallThickness,
            this.field.height,
        );
        graphics.fillStyle(SCENE_COLORS.ground, 1);
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

        this.createPlatforms(graphics);
        this.createTerrainObjects(graphics);
        this.createSurfaceLineColliders();
    }

    private createTerrainObjects(graphics: Phaser.GameObjects.Graphics): void {
        for (const terrain of this.terrainObjects) {
            graphics.fillStyle(this.getSurfaceMaterialColor(terrain.material), 1);
            this.createTerrainGraphics(graphics, terrain);
        }
    }

    private createTerrainGraphics(
        graphics: Phaser.GameObjects.Graphics,
        terrain: TerrainObjectDefinition,
    ): void {
        for (const run of this.getTerrainHorizontalRuns(terrain)) {
            graphics.fillRect(
                terrain.x + run.column * terrain.tileSize,
                terrain.y + run.row * terrain.tileSize,
                run.length * terrain.tileSize,
                terrain.tileSize,
            );
        }
    }

    private createPlatforms(graphics: Phaser.GameObjects.Graphics): void {
        for (const platform of this.surfaceObjects) {
            graphics.fillStyle(this.getSurfaceMaterialColor(platform.material), 1);

            if (platform.fillMode === 'solid-to-bottom') {
                this.createSolidSurfaceObject(graphics, platform);
            } else {
                this.createThinSurfaceObject(graphics, platform);
            }
        }
    }

    private createThinSurfaceObject(
        graphics: Phaser.GameObjects.Graphics,
        platform: SurfaceObjectDefinition,
    ): void {
        graphics.save();
        graphics.translateCanvas(platform.x, platform.y);
        graphics.rotateCanvas(this.degToRad(platform.angle));
        graphics.fillRect(
            -platform.width / 2,
            -platform.height / 2,
            platform.width,
            platform.height,
        );
        graphics.restore();
        this.drawSurfaceMaterialSections(graphics, platform);

        if (this.isBoundaryWallMaterialMarker(platform)) {
            return;
        }

        this.createThinSurfaceBody(platform);
    }

    private createThinSurfaceBody(platform: SurfaceObjectDefinition): void {
        this.scene.matter.add.rectangle(platform.x, platform.y, platform.width, platform.height, {
            isStatic: true,
            angle: this.degToRad(platform.angle),
            label: platform.id,
        });
    }

    private createSolidSurfaceObject(
        graphics: Phaser.GameObjects.Graphics,
        platform: SurfaceObjectDefinition,
    ): void {
        const polygon = this.getSolidSurfacePolygon(platform);

        graphics.fillPoints(polygon, true);
        this.drawSurfaceMaterialSections(graphics, platform);
        this.createThinSurfaceBody(platform);
        this.createSolidSurfaceFillBodies(platform, polygon);
    }

    private createSolidSurfaceFillBodies(
        platform: SurfaceObjectDefinition,
        polygon: SolidSurfacePolygon,
    ): void {
        const [topLeft, topRight] = polygon;
        const leftPoint = topLeft.x <= topRight.x ? topLeft : topRight;
        const rightPoint = topLeft.x <= topRight.x ? topRight : topLeft;
        const minX = leftPoint.x;
        const maxX = rightPoint.x;
        const fillWidth = maxX - minX;
        const maxFillBodyWidth = 8;

        if (fillWidth <= 0) {
            return;
        }

        const bodyCount = Math.max(1, Math.ceil(fillWidth / maxFillBodyWidth));
        const fillBodyWidth = fillWidth / bodyCount;

        for (let index = 0; index < bodyCount; index += 1) {
            const bodyCenterX = minX + fillBodyWidth * (index + 0.5);
            const ratio = (bodyCenterX - minX) / fillWidth;
            const topY = this.lerp(leftPoint.y, rightPoint.y, ratio);
            const height = this.getGroundTopY() - topY;

            if (height <= 0) {
                continue;
            }

            this.scene.matter.add.rectangle(bodyCenterX, topY + height / 2, fillBodyWidth, height, {
                isStatic: true,
                label: `${platform.id}-solid-fill`,
            });
        }
    }

    private createSurfaceLineColliders(): void {
        for (const line of this.surfaceLineObjects) {
            if (!line.colliderVertices || line.colliderVertices.length < 3) {
                continue;
            }

            const center = this.getSurfaceLineColliderCenter(line.colliderVertices);

            this.scene.matter.add.fromVertices(center.x, center.y, line.colliderVertices, {
                isStatic: true,
                label: `${line.id}-polygon`,
            });
        }
    }

    private getSurfaceLineColliderCenter(
        vertices: Array<Phaser.Types.Math.Vector2Like>,
    ): Phaser.Types.Math.Vector2Like {
        const centroid = this.getPolygonCentroid(vertices);

        return centroid ?? this.getPolygonAveragePoint(vertices);
    }

    private getPolygonCentroid(
        vertices: Array<Phaser.Types.Math.Vector2Like>,
    ): Phaser.Types.Math.Vector2Like | undefined {
        let areaSum = 0;
        let centerXSum = 0;
        let centerYSum = 0;

        for (let index = 0; index < vertices.length; index += 1) {
            const current = vertices[index];
            const next = vertices[(index + 1) % vertices.length];

            if (!current || !next) {
                continue;
            }

            const cross = current.x * next.y - next.x * current.y;

            areaSum += cross;
            centerXSum += (current.x + next.x) * cross;
            centerYSum += (current.y + next.y) * cross;
        }

        if (Math.abs(areaSum) < 0.001) {
            return undefined;
        }

        return {
            x: centerXSum / (3 * areaSum),
            y: centerYSum / (3 * areaSum),
        };
    }

    private getPolygonAveragePoint(
        vertices: Array<Phaser.Types.Math.Vector2Like>,
    ): Phaser.Types.Math.Vector2Like {
        const sum = vertices.reduce(
            (currentSum, vertex) => ({
                x: currentSum.x + vertex.x,
                y: currentSum.y + vertex.y,
            }),
            { x: 0, y: 0 },
        );

        return {
            x: sum.x / vertices.length,
            y: sum.y / vertices.length,
        };
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

    public getSurfaceEdges(): readonly SurfaceEdge[] {
        return this.surfaceEdges;
    }

    public getAttachmentSurfaces(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentSurface[] {
        const candidates = this.getSurfaceEdgeAttachmentCandidates(position, probe, tolerance);

        return candidates
            .sort(
                (a, b) =>
                    this.roundDistance(a.distance) - this.roundDistance(b.distance) ||
                    a.surface.edgeId.localeCompare(b.surface.edgeId),
            )
            .map((candidate) => candidate.surface);
    }

    public getSupportingAttachmentSurface(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentSurface | undefined {
        return this.getAttachmentSurfaces(position, probe, tolerance).find((surface) =>
            this.isSurfaceAgainstGravity(surface),
        );
    }

    private isSurfaceAgainstGravity(surface: AttachmentSurface): boolean {
        const gravity = { x: 0, y: 1 };
        const normalGravityProjection = surface.normal.x * gravity.x + surface.normal.y * gravity.y;

        return normalGravityProjection <= -0.2;
    }

    private createSurfaceEdges(): SurfaceEdge[] {
        return [
            ...this.createBoundarySurfaceEdges(),
            ...this.surfaceLineObjects.map((line) => this.createSurfaceLineEdge(line)),
            ...this.surfaceObjects.flatMap((platform) => this.createObjectSurfaceEdges(platform)),
        ];
    }

    private createSurfaceLineEdge(line: SurfaceLineObjectDefinition): SurfaceEdge {
        return {
            id: line.id,
            start: line.start,
            end: line.end,
            normal: line.normal,
            material: line.material,
            materialSections: line.surfaceSections,
        };
    }

    private getTerrainHorizontalRuns(terrain: TerrainObjectDefinition): TerrainHorizontalRun[] {
        const runs: TerrainHorizontalRun[] = [];

        for (let row = 0; row < terrain.rows; row += 1) {
            let column = 0;

            while (column < terrain.columns) {
                if (!this.isTerrainTileFilled(terrain, column, row)) {
                    column += 1;
                    continue;
                }

                const runStart = column;

                while (column < terrain.columns && this.isTerrainTileFilled(terrain, column, row)) {
                    column += 1;
                }

                runs.push({
                    row,
                    column: runStart,
                    length: column - runStart,
                });
            }
        }

        return runs;
    }

    private isTerrainTileFilled(
        terrain: TerrainObjectDefinition,
        column: number,
        row: number,
    ): boolean {
        if (column < 0 || row < 0 || column >= terrain.columns || row >= terrain.rows) {
            return false;
        }

        return terrain.tiles[row * terrain.columns + column] ?? false;
    }

    private createBoundarySurfaceEdges(): SurfaceEdge[] {
        const fieldX = this.getFieldX();
        const groundTopY = this.getGroundTopY();
        const leftWallRightX = fieldX + this.field.wallThickness;
        const rightWallLeftX = fieldX + this.field.width - this.field.wallThickness;
        const leftWallMaterialSections = this.createBoundaryWallMaterialSections(leftWallRightX);
        const rightWallMaterialSections = this.createBoundaryWallMaterialSections(rightWallLeftX);

        return [
            {
                id: `${this.field.id}-ground-top`,
                start: { x: leftWallRightX, y: groundTopY },
                end: { x: rightWallLeftX, y: groundTopY },
                normal: { x: 0, y: -1 },
                material: 'default',
                materialSections: [],
            },
            {
                id: `${this.field.id}-left-wall-inner`,
                start: { x: leftWallRightX, y: groundTopY },
                end: { x: leftWallRightX, y: this.getFieldY() },
                normal: { x: 1, y: 0 },
                material: 'default',
                materialSections: leftWallMaterialSections,
            },
            {
                id: `${this.field.id}-right-wall-inner`,
                start: { x: rightWallLeftX, y: groundTopY },
                end: { x: rightWallLeftX, y: this.getFieldY() },
                normal: { x: -1, y: 0 },
                material: 'default',
                materialSections: rightWallMaterialSections,
            },
        ];
    }

    private createBoundaryWallMaterialSections(wallX: number): SurfaceMaterialSection[] {
        const fieldTopY = this.getFieldY();
        const groundTopY = this.getGroundTopY();
        const wallLength = groundTopY - fieldTopY;

        if (wallLength <= 0) {
            return [];
        }

        return this.surfaceObjects.flatMap((platform) => {
            if (!this.isBoundaryWallMaterialObject(platform, wallX)) {
                return [];
            }

            const objectStartRatio = this.clamp(
                (groundTopY - (platform.y + platform.width / 2)) / wallLength,
                0,
                1,
            );
            const objectEndRatio = this.clamp(
                (groundTopY - (platform.y - platform.width / 2)) / wallLength,
                0,
                1,
            );
            const startRatio = Math.min(objectStartRatio, objectEndRatio);
            const endRatio = Math.max(objectStartRatio, objectEndRatio);

            if (endRatio <= startRatio) {
                return [];
            }

            const sections =
                platform.surfaceSections.length > 0
                    ? platform.surfaceSections
                    : [
                          {
                              id: `${platform.id}-boundary-section`,
                              name: platform.name,
                              startRatio: 0,
                              endRatio: 1,
                              material: platform.material,
                          },
                      ];

            return sections
                .filter((section) => section.material !== 'default')
                .map((section) => {
                    const localStartRatio = Math.min(section.startRatio, section.endRatio);
                    const localEndRatio = Math.max(section.startRatio, section.endRatio);
                    const sectionLength = endRatio - startRatio;

                    return {
                        ...section,
                        id: `${section.id}-boundary`,
                        startRatio: startRatio + sectionLength * this.clamp(localStartRatio, 0, 1),
                        endRatio: startRatio + sectionLength * this.clamp(localEndRatio, 0, 1),
                    };
                });
        });
    }

    private isBoundaryWallMaterialObject(
        platform: SurfaceObjectDefinition,
        wallX: number,
    ): boolean {
        const hasMaterialOverride =
            platform.material !== 'default' ||
            platform.surfaceSections.some((section) => section.material !== 'default');

        if (!hasMaterialOverride) {
            return false;
        }

        const angle = this.degToRad(platform.angle);
        const isVertical = Math.abs(Math.abs(Math.sin(angle)) - 1) < 0.001;
        const overlapsWallX =
            Math.abs(platform.x - wallX) <= Math.max(platform.height, this.field.wallThickness);

        return isVertical && overlapsWallX;
    }

    private isBoundaryWallMaterialMarker(platform: SurfaceObjectDefinition): boolean {
        const fieldX = this.getFieldX();
        const leftWallRightX = fieldX + this.field.wallThickness;
        const rightWallLeftX = fieldX + this.field.width - this.field.wallThickness;

        return (
            this.isBoundaryWallMaterialObject(platform, leftWallRightX) ||
            this.isBoundaryWallMaterialObject(platform, rightWallLeftX)
        );
    }

    private createObjectSurfaceEdges(platform: SurfaceObjectDefinition): SurfaceEdge[] {
        if (this.isBoundaryWallMaterialMarker(platform)) {
            return [];
        }

        if (platform.fillMode === 'solid-to-bottom') {
            const [topLeft, topRight, bottomRight, bottomLeft] =
                this.getSolidSurfacePolygon(platform);
            const topNormal = this.getTopSurfaceNormal(topLeft, topRight);

            return [
                ...this.createTopSurfaceEdges(platform, topLeft, topRight, topNormal),
                {
                    id: `${platform.id}-left-side`,
                    start: bottomLeft,
                    end: topLeft,
                    normal: { x: -1, y: 0 },
                    material: platform.material,
                    materialSections: [],
                },
                {
                    id: `${platform.id}-right-side`,
                    start: topRight,
                    end: bottomRight,
                    normal: { x: 1, y: 0 },
                    material: platform.material,
                    materialSections: [],
                },
            ];
        }

        const corners = this.getThinSurfaceCorners(platform);

        return [
            ...this.createTopSurfaceEdges(
                platform,
                corners.topLeft,
                corners.topRight,
                corners.topNormal,
            ),
            {
                id: `${platform.id}-bottom`,
                start: corners.bottomRight,
                end: corners.bottomLeft,
                normal: {
                    x: -corners.topNormal.x,
                    y: -corners.topNormal.y,
                },
                material: platform.material,
                materialSections: [],
            },
            {
                id: `${platform.id}-left-side`,
                start: corners.bottomLeft,
                end: corners.topLeft,
                normal: {
                    x: -corners.topTangent.x,
                    y: -corners.topTangent.y,
                },
                material: platform.material,
                materialSections: [],
            },
            {
                id: `${platform.id}-right-side`,
                start: corners.topRight,
                end: corners.bottomRight,
                normal: corners.topTangent,
                material: platform.material,
                materialSections: [],
            },
        ];
    }

    private createTopSurfaceEdges(
        platform: SurfaceObjectDefinition,
        topLeft: Phaser.Types.Math.Vector2Like,
        topRight: Phaser.Types.Math.Vector2Like,
        normal: Phaser.Types.Math.Vector2Like,
    ): SurfaceEdge[] {
        return [
            {
                id: `${platform.id}-top`,
                start: topLeft,
                end: topRight,
                normal,
                material: platform.material,
                materialSections: platform.surfaceSections,
            },
        ];
    }

    private getThinSurfaceCorners(platform: SurfaceObjectDefinition): {
        topLeft: Phaser.Types.Math.Vector2Like;
        topRight: Phaser.Types.Math.Vector2Like;
        bottomRight: Phaser.Types.Math.Vector2Like;
        bottomLeft: Phaser.Types.Math.Vector2Like;
        topNormal: Phaser.Types.Math.Vector2Like;
        topTangent: Phaser.Types.Math.Vector2Like;
    } {
        const angle = this.degToRad(platform.angle);
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
        const bottomRight = this.toWorldPlatformPoint(
            { x: platform.width / 2, y: platform.height / 2 },
            platform,
            angle,
        );
        const bottomLeft = this.toWorldPlatformPoint(
            { x: -platform.width / 2, y: platform.height / 2 },
            platform,
            angle,
        );
        const topNormal = this.getTopSurfaceNormal(topLeft, topRight);
        const topTangent = this.normalizeVector({
            x: topRight.x - topLeft.x,
            y: topRight.y - topLeft.y,
        });

        return {
            topLeft,
            topRight,
            bottomRight,
            bottomLeft,
            topNormal,
            topTangent,
        };
    }

    private getTopSurfaceNormal(
        topLeft: Phaser.Types.Math.Vector2Like,
        topRight: Phaser.Types.Math.Vector2Like,
    ): Phaser.Types.Math.Vector2Like {
        const tangent = this.normalizeVector({
            x: topRight.x - topLeft.x,
            y: topRight.y - topLeft.y,
        });

        return {
            x: tangent.y,
            y: -tangent.x,
        };
    }

    private getSurfaceEdgeAttachmentCandidates(
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
    ): AttachmentCandidate[] {
        const candidates: AttachmentCandidate[] = [];

        for (const edge of this.surfaceEdges) {
            this.addSurfaceEdgeAttachmentCandidate(candidates, position, probe, tolerance, edge);
        }

        return candidates;
    }

    private addSurfaceEdgeAttachmentCandidate(
        candidates: AttachmentCandidate[],
        position: Phaser.Types.Math.Vector2Like,
        probe: AttachmentProbe,
        tolerance: number,
        edge: SurfaceEdge,
    ): void {
        const edgeVector = {
            x: edge.end.x - edge.start.x,
            y: edge.end.y - edge.start.y,
        };
        const edgeLength = Math.hypot(edgeVector.x, edgeVector.y);

        if (edgeLength <= 0) {
            return;
        }

        const tangent = {
            x: edgeVector.x / edgeLength,
            y: edgeVector.y / edgeLength,
        };
        const delta = {
            x: position.x - edge.start.x,
            y: position.y - edge.start.y,
        };
        const tangentDistance = delta.x * tangent.x + delta.y * tangent.y;
        const normalDistance = delta.x * edge.normal.x + delta.y * edge.normal.y;

        const withinSpan =
            tangentDistance >= -probe.tangentHalfLength &&
            tangentDistance <= edgeLength + probe.tangentHalfLength;

        if (!withinSpan) {
            return;
        }

        if (normalDistance < -tolerance) {
            return;
        }

        const clampedTangentDistance = this.clamp(tangentDistance, 0, edgeLength);
        const progress = clampedTangentDistance / edgeLength;
        const isShallowInsideSurface = normalDistance < 0;
        const distance = Math.abs(normalDistance - probe.normalHalfDepth);

        if (!isShallowInsideSurface && distance > tolerance) {
            return;
        }

        const closestPoint = {
            x: edge.start.x + tangent.x * clampedTangentDistance,
            y: edge.start.y + tangent.y * clampedTangentDistance,
        };
        const snapPosition = {
            x: closestPoint.x + edge.normal.x * probe.normalHalfDepth,
            y: closestPoint.y + edge.normal.y * probe.normalHalfDepth,
        };
        const snapDistance = Math.hypot(snapPosition.x - position.x, snapPosition.y - position.y);

        const allowedSnapDistance = isShallowInsideSurface
            ? tolerance + probe.normalHalfDepth
            : tolerance;

        if (snapDistance > allowedSnapDistance) {
            return;
        }

        candidates.push({
            distance,
            surface: {
                edgeId: edge.id,
                start: edge.start,
                end: edge.end,
                normal: edge.normal,
                tangent,
                snapPosition,
                progress,
                length: edgeLength,
                material: this.getSurfaceEdgeMaterialAtProgress(edge, progress),
            },
        });
    }

    private drawSurfaceMaterialSections(
        graphics: Phaser.GameObjects.Graphics,
        platform: SurfaceObjectDefinition,
    ): void {
        for (const section of platform.surfaceSections) {
            if (section.material === platform.material) {
                continue;
            }

            const startRatio = this.clamp(section.startRatio, 0, 1);
            const endRatio = this.clamp(section.endRatio, 0, 1);
            const startX = -platform.width / 2 + Math.min(startRatio, endRatio) * platform.width;
            const endX = -platform.width / 2 + Math.max(startRatio, endRatio) * platform.width;
            const width = endX - startX;

            if (width <= 0) {
                continue;
            }

            graphics.save();
            graphics.fillStyle(this.getSurfaceMaterialColor(section.material), 1);
            graphics.translateCanvas(platform.x, platform.y);
            graphics.rotateCanvas(this.degToRad(platform.angle));
            graphics.fillRect(startX, -platform.height / 2, width, platform.height);
            graphics.restore();
        }
    }

    private getSurfaceEdgeMaterialAtProgress(edge: SurfaceEdge, progress: number): SurfaceMaterial {
        const section = edge.materialSections.find((currentSection) => {
            const startRatio = Math.min(currentSection.startRatio, currentSection.endRatio);
            const endRatio = Math.max(currentSection.startRatio, currentSection.endRatio);

            return progress >= startRatio && progress <= endRatio;
        });

        return section?.material ?? edge.material;
    }

    private getSurfaceMaterialColor(material: SurfaceMaterial): number {
        return material === 'slippery' ? SCENE_COLORS.slipperyPlatform : SCENE_COLORS.platform;
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

    private normalizeVector(vector: Phaser.Types.Math.Vector2Like): Phaser.Types.Math.Vector2Like {
        const length = Math.hypot(vector.x, vector.y);

        if (length === 0) {
            return { x: 0, y: 0 };
        }

        return {
            x: vector.x / length,
            y: vector.y / length,
        };
    }

    private getSolidSurfacePolygon(platform: SurfaceObjectDefinition): SolidSurfacePolygon {
        const angle = this.degToRad(platform.angle);
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
            x: this.clamp(point.x, minX, maxX),
            y: point.y,
        };
    }

    private toWorldPlatformPoint(
        localPoint: Phaser.Types.Math.Vector2Like,
        platform: SurfaceObjectDefinition,
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

    private degToRad(degrees: number): number {
        return (degrees * Math.PI) / 180;
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    private lerp(start: number, end: number, ratio: number): number {
        return start + (end - start) * ratio;
    }

    private roundDistance(distance: number): number {
        return Math.round(distance * 100) / 100;
    }
}
