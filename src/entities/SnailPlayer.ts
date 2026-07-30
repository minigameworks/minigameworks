import Phaser from 'phaser';
import { TEMPORARY_SNAIL_CONTROL, TEMPORARY_SNAIL_MARKER } from '../config/gameConfig';
import {
    AttachmentProbe,
    AttachmentSurface,
    TemporaryPlayfield,
} from '../systems/TemporaryPlayfield';
import { SnailInputController } from '../systems/SnailInputController';

type TemporarySnailMode = 'normal' | 'shell';

type TemporarySnailMarker = Phaser.GameObjects.Shape &
    Phaser.Physics.Matter.Components.Gravity &
    Phaser.Physics.Matter.Components.SetBody &
    Phaser.Physics.Matter.Components.Transform &
    Phaser.Physics.Matter.Components.Velocity & {
        body: MatterJS.BodyType;
    };

type SurfaceMovement = {
    velocity: Phaser.Types.Math.Vector2Like;
    shouldUpdateFacing: boolean;
};

type SurfaceTravelIntent = {
    amount: number;
    isManual: boolean;
};

export class SnailPlayer {
    private readonly inputController: SnailInputController;
    private snailMode: TemporarySnailMode = 'normal';
    private snailMarker?: TemporarySnailMarker;
    private normalAttachmentSurface?: AttachmentSurface;
    private normalVisual?: Phaser.GameObjects.Container;
    private directionArrow: Phaser.GameObjects.Graphics;
    private inputDirectionArrow: Phaser.GameObjects.Graphics;
    private backDirectionMarker: Phaser.GameObjects.Graphics;
    private facingDirection = { x: 1, y: 0 };
    private visualSurfaceRotation = 0;
    private normalAttachLockedUntil = 0;

    public constructor(
        private readonly scene: Phaser.Scene,
        private readonly playfield: TemporaryPlayfield,
        startPosition: Phaser.Types.Math.Vector2Like,
    ) {
        this.inputController = new SnailInputController(this.scene);
        this.createTemporarySnailMarker(this.snailMode, startPosition);
        this.directionArrow = this.scene.add.graphics();
        this.inputDirectionArrow = this.scene.add.graphics();
        this.backDirectionMarker = this.scene.add.graphics();
        this.updateTemporaryDirectionArrow();
        this.updateTemporaryInputDirectionArrow();
        this.updateTemporaryBackDirectionMarker();
        this.configureTemporaryDebugMarkers();
    }

    public update(): void {
        this.updateTemporarySnailInput();
    }

    public getGameObject(): Phaser.GameObjects.GameObject {
        if (!this.snailMarker) {
            throw new Error('달팽이 임시 마커가 아직 생성되지 않았다.');
        }

        return this.snailMarker;
    }

    public getPosition(): Phaser.Types.Math.Vector2Like {
        if (!this.snailMarker) {
            throw new Error('달팽이 임시 마커가 아직 생성되지 않았다.');
        }

        return {
            x: this.snailMarker.x,
            y: this.snailMarker.y,
        };
    }

    private configureTemporaryDebugMarkers(): void {
        this.directionArrow.setDepth(20);
        this.inputDirectionArrow.setDepth(21);
        this.backDirectionMarker.setDepth(22);
    }

    private updateTemporarySnailInput(): void {
        if (!this.snailMarker) {
            return;
        }

        if (this.inputController.isShellToggleJustDown()) {
            this.toggleTemporarySnailMode();
        }

        if (this.snailMode === 'shell') {
            this.updateTemporaryShellInput();
        } else {
            this.updateTemporaryNormalInput();
        }

        this.alignTemporaryMarkerToSurface();
        this.applyTemporaryAirDownwardAcceleration();
        this.syncTemporaryNormalVisual();
        this.updateTemporaryDirectionArrow();
        this.updateTemporaryInputDirectionArrow();
        this.updateTemporaryBackDirectionMarker();
    }

    private updateTemporaryShellInput(): void {
        if (!this.snailMarker) {
            return;
        }

        const moveDirection = this.getTemporaryMoveDirection();
        const slopeSurface = this.getTemporaryShellSlopeSurface();
        const isGrounded = Boolean(this.getTemporarySupportingSurface());
        const canSteerShell = isGrounded || Boolean(slopeSurface);

        if (moveDirection !== 0) {
            this.facingDirection = { x: moveDirection, y: 0 };
        }

        this.applyTemporaryShellHorizontalAcceleration(moveDirection, canSteerShell);
        this.applyTemporaryShellSlopeBoost(moveDirection, slopeSurface);
        this.clampTemporaryShellHorizontalSpeed();

        if (this.isTemporaryJumpJustDown() && isGrounded) {
            this.snailMarker.setVelocity(
                this.snailMarker.getVelocity().x,
                TEMPORARY_SNAIL_CONTROL.shellJumpVelocity,
            );
        }
    }

    private applyTemporaryShellHorizontalAcceleration(
        moveDirection: number,
        canSteerShell: boolean,
    ): void {
        if (!this.snailMarker) {
            return;
        }

        const velocity = this.snailMarker.getVelocity();

        if (moveDirection !== 0) {
            const acceleration = canSteerShell
                ? TEMPORARY_SNAIL_CONTROL.shellMoveAcceleration
                : TEMPORARY_SNAIL_CONTROL.shellAirMoveAcceleration;

            this.snailMarker.setVelocityX(velocity.x + moveDirection * acceleration);
            return;
        }

        const friction = this.getTemporarySupportingSurface()
            ? TEMPORARY_SNAIL_CONTROL.shellGroundFriction
            : TEMPORARY_SNAIL_CONTROL.shellAirFriction;

        this.snailMarker.setVelocityX(velocity.x * friction);
    }

    private clampTemporaryShellHorizontalSpeed(): void {
        if (!this.snailMarker) {
            return;
        }

        const velocity = this.snailMarker.getVelocity();
        const clampedVelocityX = Phaser.Math.Clamp(
            velocity.x,
            -TEMPORARY_SNAIL_CONTROL.shellMaxHorizontalSpeed,
            TEMPORARY_SNAIL_CONTROL.shellMaxHorizontalSpeed,
        );

        if (clampedVelocityX !== velocity.x) {
            this.snailMarker.setVelocityX(clampedVelocityX);
        }
    }

    private updateTemporaryNormalInput(): void {
        if (!this.snailMarker) {
            return;
        }

        const moveDirection = this.getTemporaryMoveDirection();
        const climbDirection = this.getTemporaryClimbDirection();
        const attachmentSurface = this.isTemporaryNormalAttachLocked()
            ? undefined
            : this.getTemporaryNormalAttachmentSurface(moveDirection, climbDirection);

        if (attachmentSurface) {
            this.updateTemporaryAttachedNormalInput(
                attachmentSurface,
                moveDirection,
                climbDirection,
            );
            return;
        }

        this.snailMarker.setIgnoreGravity(false);
        this.normalAttachmentSurface = undefined;

        if (moveDirection !== 0) {
            this.facingDirection = { x: moveDirection, y: 0 };
        }

        this.snailMarker.setVelocityX(moveDirection * TEMPORARY_SNAIL_CONTROL.normalMoveSpeed);
    }

    private getTemporaryMoveDirection(): number {
        return this.inputController.getMoveDirection();
    }

    private getTemporaryClimbDirection(): number {
        return this.inputController.getClimbDirection();
    }

    private updateTemporaryAttachedNormalInput(
        surface: AttachmentSurface,
        moveDirection: number,
        climbDirection: number,
    ): void {
        if (!this.snailMarker) {
            return;
        }

        const movement = this.getTemporarySurfaceMovement(surface, moveDirection, climbDirection);

        this.snailMarker.setIgnoreGravity(true);
        this.normalAttachmentSurface = surface;
        this.snapTemporaryNormalMarkerToSurface(surface);

        this.snailMarker.setVelocity(movement.velocity.x, movement.velocity.y);

        if (movement.shouldUpdateFacing) {
            this.facingDirection = this.normalizeVector(movement.velocity);
        }
    }

    private getTemporarySurfaceMovement(
        surface: AttachmentSurface,
        moveDirection: number,
        climbDirection: number,
    ): SurfaceMovement {
        const intent = this.getTemporarySurfaceTravelIntent(surface, moveDirection, climbDirection);
        const speed = this.getTemporarySurfaceMoveSpeed(surface, intent);

        return {
            velocity: {
                x: surface.tangent.x * intent.amount * speed,
                y: surface.tangent.y * intent.amount * speed,
            },
            shouldUpdateFacing: intent.isManual && intent.amount !== 0,
        };
    }

    private getTemporarySurfaceTravelIntent(
        surface: AttachmentSurface,
        moveDirection: number,
        climbDirection: number,
    ): SurfaceTravelIntent {
        const input = this.getTemporaryWorldInputVector(moveDirection, climbDirection);
        const projectedInput = input.x * surface.tangent.x + input.y * surface.tangent.y;

        if (projectedInput !== 0) {
            return {
                amount: Math.sign(projectedInput),
                isManual: true,
            };
        }

        if (Math.abs(surface.normal.x) > 0.8) {
            return {
                amount: Math.sign(surface.tangent.y),
                isManual: false,
            };
        }

        return {
            amount: 0,
            isManual: false,
        };
    }

    private getTemporaryWorldInputVector(
        moveDirection: number,
        climbDirection: number,
    ): Phaser.Types.Math.Vector2Like {
        const input = {
            x: moveDirection,
            y: climbDirection,
        };
        const length = Math.hypot(input.x, input.y);

        if (length === 0) {
            return { x: 0, y: 0 };
        }

        return {
            x: input.x / length,
            y: input.y / length,
        };
    }

    private getTemporarySurfaceMoveSpeed(
        surface: AttachmentSurface,
        intent: SurfaceTravelIntent,
    ): number {
        if (!intent.isManual && Math.abs(surface.normal.x) > 0.8) {
            return TEMPORARY_SNAIL_CONTROL.wallSlideSpeed;
        }

        if (Math.abs(surface.tangent.y) > 0.8) {
            return intent.amount * surface.tangent.y > 0
                ? TEMPORARY_SNAIL_CONTROL.normalClimbDownSpeed
                : TEMPORARY_SNAIL_CONTROL.normalClimbSpeed;
        }

        return TEMPORARY_SNAIL_CONTROL.normalAttachMoveSpeed;
    }

    private getTemporaryNormalAttachmentSurface(
        moveDirection: number,
        climbDirection: number,
    ): AttachmentSurface | undefined {
        if (!this.snailMarker) {
            return undefined;
        }

        const surfaces = this.playfield.getAttachmentSurfaces(
            this.snailMarker,
            this.getTemporaryAttachmentProbe(),
            TEMPORARY_SNAIL_CONTROL.contactTolerance,
        );

        if (surfaces.length === 0) {
            return undefined;
        }

        const input = {
            x: moveDirection,
            y: climbDirection,
        };
        const hasManualInput = input.x !== 0 || input.y !== 0;

        if (!hasManualInput) {
            return (
                surfaces.find((surface) =>
                    this.isSameTemporarySurface(surface, this.normalAttachmentSurface),
                ) ?? surfaces[0]
            );
        }

        return surfaces
            .map((surface, index) => ({
                surface,
                score: this.getTemporarySurfaceInputScore(surface, input) - index * 0.01,
            }))
            .sort((a, b) => b.score - a.score)[0]?.surface;
    }

    private getTemporarySurfaceInputScore(
        surface: AttachmentSurface,
        input: Phaser.Types.Math.Vector2Like,
    ): number {
        const inputVector = this.getTemporaryWorldInputVector(input.x, input.y);
        let score = Math.abs(inputVector.x * surface.tangent.x + inputVector.y * surface.tangent.y);

        if (this.isSameTemporarySurface(surface, this.normalAttachmentSurface)) {
            score += 0.2;
        }

        return score;
    }

    private isSameTemporarySurface(
        surface: AttachmentSurface,
        target?: AttachmentSurface,
    ): boolean {
        if (!target) {
            return false;
        }

        return surface.normal.x === target.normal.x && surface.normal.y === target.normal.y;
    }

    private applyTemporaryShellSlopeBoost(
        moveDirection: number,
        surface: AttachmentSurface | undefined,
    ): void {
        if (!this.snailMarker || !surface) {
            return;
        }

        const downhill =
            surface.tangent.y > 0
                ? surface.tangent
                : {
                      x: -surface.tangent.x,
                      y: -surface.tangent.y,
                  };
        const acceleration =
            moveDirection === 0
                ? TEMPORARY_SNAIL_CONTROL.shellSlopePassiveAcceleration
                : TEMPORARY_SNAIL_CONTROL.shellSlopeInputAcceleration;
        const maxSpeed =
            moveDirection === 0
                ? TEMPORARY_SNAIL_CONTROL.shellSlopePassiveMaxSpeed
                : TEMPORARY_SNAIL_CONTROL.shellSlopeInputMaxSpeed;

        if (moveDirection !== 0 && Math.sign(downhill.x) !== moveDirection) {
            return;
        }

        const velocity = this.snailMarker.getVelocity();
        const nextVelocity = {
            x: velocity.x + downhill.x * acceleration,
            y: velocity.y + downhill.y * acceleration,
        };
        const downhillSpeed = nextVelocity.x * downhill.x + nextVelocity.y * downhill.y;

        if (downhillSpeed > maxSpeed) {
            const overflow = downhillSpeed - maxSpeed;

            nextVelocity.x -= downhill.x * overflow;
            nextVelocity.y -= downhill.y * overflow;
        }

        this.snailMarker.setVelocity(nextVelocity.x, nextVelocity.y);
    }

    private getTemporaryShellSlopeSurface(): AttachmentSurface | undefined {
        const surface = this.getTemporarySupportingSurface();

        if (!surface || surface.normal.y > -0.2 || Math.abs(surface.tangent.y) < 0.05) {
            return undefined;
        }

        return surface;
    }

    private applyTemporaryAirDownwardAcceleration(): void {
        if (
            !this.snailMarker ||
            this.normalAttachmentSurface ||
            this.getTemporarySupportingSurface()
        ) {
            return;
        }

        const velocity = this.snailMarker.getVelocity();

        this.snailMarker.setVelocity(
            velocity.x,
            velocity.y + TEMPORARY_SNAIL_CONTROL.temporaryShortHopFallAcceleration,
        );
    }

    private isTemporaryJumpJustDown(): boolean {
        return this.inputController.isJumpJustDown();
    }

    private toggleTemporarySnailMode(): void {
        if (!this.snailMarker) {
            return;
        }

        const previousMarker = this.snailMarker;
        const previousVelocity = previousMarker.getVelocity();
        const nextMode: TemporarySnailMode = this.snailMode === 'normal' ? 'shell' : 'normal';
        const position = {
            x: previousMarker.x,
            y: previousMarker.y,
        };

        this.destroyTemporaryNormalVisual();
        previousMarker.destroy();
        this.snailMode = nextMode;
        this.normalAttachmentSurface = undefined;
        this.normalAttachLockedUntil =
            nextMode === 'normal'
                ? this.scene.time.now + TEMPORARY_SNAIL_CONTROL.modeSwitchAttachCooldownMs
                : 0;
        this.createTemporarySnailMarker(nextMode, position);
        this.snailMarker?.setVelocity(previousVelocity.x, previousVelocity.y);
        this.syncTemporaryNormalVisual();
        this.updateTemporaryDirectionArrow();
        this.updateTemporaryInputDirectionArrow();
        this.updateTemporaryBackDirectionMarker();
    }

    private createTemporarySnailMarker(
        mode: TemporarySnailMode,
        position: Phaser.Types.Math.Vector2Like,
    ): void {
        const marker =
            mode === 'shell'
                ? this.createTemporaryShellMarker(position)
                : this.createTemporaryNormalMarker(position);

        this.snailMarker = marker;
    }

    private isTemporaryNormalAttachLocked(): boolean {
        return this.scene.time.now < this.normalAttachLockedUntil;
    }

    private createTemporaryNormalMarker(
        position: Phaser.Types.Math.Vector2Like,
    ): TemporarySnailMarker {
        const marker = this.scene.add.circle(
            position.x,
            position.y,
            1,
            TEMPORARY_SNAIL_MARKER.normalColor,
            0,
        );
        const radius = TEMPORARY_SNAIL_MARKER.normalSegmentRadius;
        const halfSpacing = TEMPORARY_SNAIL_MARKER.normalSegmentSpacing / 2;
        const frontBody = this.scene.matter.bodies.circle(
            position.x + halfSpacing,
            position.y,
            radius,
            {
                label: 'temporary-normal-snail-front-segment',
            },
        );
        const backBody = this.scene.matter.bodies.circle(
            position.x - halfSpacing,
            position.y,
            radius,
            {
                label: 'temporary-normal-snail-back-segment',
            },
        );
        const compoundBody = this.scene.matter.body.create({
            label: 'temporary-normal-snail-marker',
            parts: [frontBody, backBody],
            restitution: TEMPORARY_SNAIL_MARKER.restitution,
        });

        const matterMarker = this.scene.matter.add.gameObject(marker) as TemporarySnailMarker;

        matterMarker.setExistingBody(compoundBody);
        matterMarker.setFixedRotation();
        matterMarker.setIgnoreGravity(false);
        this.normalVisual = this.createTemporaryNormalVisual(position);

        return matterMarker;
    }

    private snapTemporaryNormalMarkerToSurface(surface: AttachmentSurface): void {
        if (!this.snailMarker) {
            return;
        }

        this.snailMarker.setPosition(surface.snapPosition.x, surface.snapPosition.y);
    }

    private createTemporaryShellMarker(
        position: Phaser.Types.Math.Vector2Like,
    ): TemporarySnailMarker {
        const marker = this.scene.add.circle(
            position.x,
            position.y,
            TEMPORARY_SNAIL_MARKER.shellRadius,
            TEMPORARY_SNAIL_MARKER.shellColor,
        );

        const matterMarker = this.scene.matter.add.gameObject(marker, {
            label: 'temporary-shell-snail-marker',
            shape: {
                type: 'circle',
                radius: TEMPORARY_SNAIL_MARKER.shellRadius,
            },
            restitution: TEMPORARY_SNAIL_MARKER.restitution,
        }) as TemporarySnailMarker;

        matterMarker.setIgnoreGravity(false);

        return matterMarker;
    }

    private createTemporaryNormalVisual(
        position: Phaser.Types.Math.Vector2Like,
    ): Phaser.GameObjects.Container {
        const frontSegment = this.scene.add.circle(
            TEMPORARY_SNAIL_MARKER.normalSegmentSpacing / 2,
            0,
            TEMPORARY_SNAIL_MARKER.normalSegmentRadius,
            TEMPORARY_SNAIL_MARKER.normalColor,
        );
        const backSegment = this.scene.add.circle(
            -TEMPORARY_SNAIL_MARKER.normalSegmentSpacing / 2,
            0,
            TEMPORARY_SNAIL_MARKER.normalSegmentRadius,
            TEMPORARY_SNAIL_MARKER.normalBackColor,
        );
        const connector = this.scene.add.rectangle(
            0,
            0,
            TEMPORARY_SNAIL_MARKER.normalConnectorWidth,
            TEMPORARY_SNAIL_MARKER.normalConnectorHeight,
            TEMPORARY_SNAIL_MARKER.normalConnectorColor,
        );

        const visual = this.scene.add.container(position.x, position.y, [
            connector,
            backSegment,
            frontSegment,
        ]);

        visual.setDepth(10);

        return visual;
    }

    private syncTemporaryNormalVisual(): void {
        if (!this.normalVisual || !this.snailMarker) {
            return;
        }

        this.normalVisual.setPosition(this.snailMarker.x, this.snailMarker.y);
        this.normalVisual.setRotation(this.visualSurfaceRotation);
        this.normalVisual.setScale(this.getTemporaryNormalVisualDirectionScale(), 1);
    }

    private getTemporaryNormalVisualDirectionScale(): number {
        if (!this.snailMarker) {
            return 1;
        }

        const surface =
            this.snailMode === 'normal'
                ? (this.normalAttachmentSurface ?? this.getTemporaryAttachmentSurface())
                : this.getTemporarySupportingSurface();
        const tangent = surface
            ? surface.tangent
            : {
                  x: Math.cos(this.snailMarker.rotation),
                  y: Math.sin(this.snailMarker.rotation),
              };
        const facingProjection =
            this.facingDirection.x * tangent.x + this.facingDirection.y * tangent.y;

        return facingProjection < 0 ? -1 : 1;
    }

    private destroyTemporaryNormalVisual(): void {
        this.normalVisual?.destroy();
        this.normalVisual = undefined;
    }

    private alignTemporaryMarkerToSurface(): void {
        if (!this.snailMarker) {
            return;
        }

        const surface =
            this.snailMode === 'normal'
                ? (this.normalAttachmentSurface ?? this.getTemporaryAttachmentSurface())
                : this.getTemporarySupportingSurface();

        if (!surface) {
            if (this.snailMode === 'normal') {
                this.snailMarker.setAngle(0);
                this.visualSurfaceRotation = Phaser.Math.Angle.RotateTo(
                    this.visualSurfaceRotation,
                    0,
                    TEMPORARY_SNAIL_MARKER.surfaceRotationLerp,
                );
            }

            return;
        }

        const surfaceAngle = Phaser.Math.RadToDeg(Math.atan2(surface.tangent.y, surface.tangent.x));

        this.snailMarker.setAngle(surfaceAngle);
        this.visualSurfaceRotation = Phaser.Math.Angle.RotateTo(
            this.visualSurfaceRotation,
            Phaser.Math.DegToRad(surfaceAngle),
            TEMPORARY_SNAIL_MARKER.surfaceRotationLerp,
        );
    }

    private updateTemporaryDirectionArrow(): void {
        if (!this.snailMarker) {
            return;
        }

        const length = TEMPORARY_SNAIL_MARKER.directionArrowLength;
        const halfWidth = TEMPORARY_SNAIL_MARKER.directionArrowWidth / 2;
        const baseDistance =
            this.getTemporarySnailHalfSize() + TEMPORARY_SNAIL_MARKER.directionArrowGap;
        const tipDistance = baseDistance + length;
        const frontX = this.snailMarker.x + this.facingDirection.x * tipDistance;
        const frontY = this.snailMarker.y + this.facingDirection.y * tipDistance;
        const backCenterX = this.snailMarker.x + this.facingDirection.x * baseDistance;
        const backCenterY = this.snailMarker.y + this.facingDirection.y * baseDistance;
        const perpendicularX = -this.facingDirection.y;
        const perpendicularY = this.facingDirection.x;

        this.directionArrow.clear();
        this.directionArrow.fillStyle(TEMPORARY_SNAIL_MARKER.directionColor, 1);
        this.directionArrow.fillTriangle(
            frontX,
            frontY,
            backCenterX + perpendicularX * halfWidth,
            backCenterY + perpendicularY * halfWidth,
            backCenterX - perpendicularX * halfWidth,
            backCenterY - perpendicularY * halfWidth,
        );
    }

    private updateTemporaryInputDirectionArrow(): void {
        if (!this.snailMarker) {
            return;
        }

        const inputDirection = this.getTemporaryWorldInputVector(
            this.getTemporaryMoveDirection(),
            this.getTemporaryClimbDirection(),
        );

        this.inputDirectionArrow.clear();

        if (inputDirection.x === 0 && inputDirection.y === 0) {
            return;
        }

        this.drawTemporaryDirectionTriangle(
            this.inputDirectionArrow,
            inputDirection,
            TEMPORARY_SNAIL_MARKER.inputDirectionColor,
            TEMPORARY_SNAIL_MARKER.inputArrowLength,
            TEMPORARY_SNAIL_MARKER.inputArrowWidth,
            this.getTemporarySnailHalfSize() + TEMPORARY_SNAIL_MARKER.directionArrowGap + 20,
        );
    }

    private updateTemporaryBackDirectionMarker(): void {
        if (!this.snailMarker) {
            return;
        }

        const backDirection = this.getTemporaryBackDirection();
        const startDistance = this.getTemporarySnailHalfSize() - 2;
        const startX = this.snailMarker.x + backDirection.x * startDistance;
        const startY = this.snailMarker.y + backDirection.y * startDistance;
        const endX =
            this.snailMarker.x +
            backDirection.x * (startDistance + TEMPORARY_SNAIL_MARKER.backMarkerLength);
        const endY =
            this.snailMarker.y +
            backDirection.y * (startDistance + TEMPORARY_SNAIL_MARKER.backMarkerLength);

        this.backDirectionMarker.clear();
        this.backDirectionMarker.lineStyle(
            TEMPORARY_SNAIL_MARKER.backMarkerWidth,
            TEMPORARY_SNAIL_MARKER.backDirectionColor,
            1,
        );
        this.backDirectionMarker.lineBetween(startX, startY, endX, endY);
    }

    private getTemporaryBackDirection(): Phaser.Types.Math.Vector2Like {
        const surface =
            this.snailMode === 'normal'
                ? (this.normalAttachmentSurface ?? this.getTemporaryAttachmentSurface())
                : this.getTemporarySupportingSurface();

        if (surface) {
            return surface.normal;
        }

        return { x: 0, y: -1 };
    }

    private drawTemporaryDirectionTriangle(
        graphics: Phaser.GameObjects.Graphics,
        direction: Phaser.Types.Math.Vector2Like,
        color: number,
        length: number,
        width: number,
        baseDistance: number,
    ): void {
        if (!this.snailMarker) {
            return;
        }

        const halfWidth = width / 2;
        const tipDistance = baseDistance + length;
        const frontX = this.snailMarker.x + direction.x * tipDistance;
        const frontY = this.snailMarker.y + direction.y * tipDistance;
        const backCenterX = this.snailMarker.x + direction.x * baseDistance;
        const backCenterY = this.snailMarker.y + direction.y * baseDistance;
        const perpendicularX = -direction.y;
        const perpendicularY = direction.x;

        graphics.fillStyle(color, 1);
        graphics.fillTriangle(
            frontX,
            frontY,
            backCenterX + perpendicularX * halfWidth,
            backCenterY + perpendicularY * halfWidth,
            backCenterX - perpendicularX * halfWidth,
            backCenterY - perpendicularY * halfWidth,
        );
    }

    private getTemporarySupportingSurface(): AttachmentSurface | undefined {
        if (!this.snailMarker) {
            return undefined;
        }

        return this.playfield.getSupportingAttachmentSurface(
            this.snailMarker,
            this.getTemporaryAttachmentProbe(),
            TEMPORARY_SNAIL_CONTROL.contactTolerance,
        );
    }

    private getTemporaryAttachmentSurface(): AttachmentSurface | undefined {
        if (!this.snailMarker) {
            return undefined;
        }

        return this.playfield.getAttachmentSurface(
            this.snailMarker,
            this.getTemporaryAttachmentProbe(),
            TEMPORARY_SNAIL_CONTROL.contactTolerance,
        );
    }

    private getTemporaryAttachmentProbe(): AttachmentProbe {
        if (this.snailMode === 'shell') {
            return {
                tangentHalfLength: TEMPORARY_SNAIL_MARKER.shellRadius,
                normalHalfDepth: TEMPORARY_SNAIL_MARKER.shellRadius,
            };
        }

        return {
            tangentHalfLength:
                TEMPORARY_SNAIL_MARKER.normalSegmentSpacing / 2 +
                TEMPORARY_SNAIL_MARKER.normalSegmentRadius,
            normalHalfDepth: TEMPORARY_SNAIL_MARKER.normalSegmentRadius,
        };
    }

    private getTemporarySnailHalfSize(): number {
        return this.snailMode === 'shell'
            ? TEMPORARY_SNAIL_MARKER.shellRadius
            : TEMPORARY_SNAIL_MARKER.normalSegmentRadius;
    }

    private normalizeVector(vector: Phaser.Types.Math.Vector2Like): Phaser.Types.Math.Vector2Like {
        const length = Math.hypot(vector.x, vector.y);

        if (length === 0) {
            return this.facingDirection;
        }

        return {
            x: vector.x / length,
            y: vector.y / length,
        };
    }
}
