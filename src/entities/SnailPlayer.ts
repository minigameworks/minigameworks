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

export class SnailPlayer {
    private readonly inputController: SnailInputController;
    private snailMode: TemporarySnailMode = 'normal';
    private snailMarker?: TemporarySnailMarker;
    private normalAttachmentSurface?: AttachmentSurface;
    private recognizedAttachmentSurfaces: AttachmentSurface[] = [];
    private normalVisual?: Phaser.GameObjects.Container;
    private directionArrow: Phaser.GameObjects.Graphics;
    private inputDirectionArrow: Phaser.GameObjects.Graphics;
    private backDirectionMarker: Phaser.GameObjects.Graphics;
    private debugHudText: Phaser.GameObjects.Text;
    private facingDirection = { x: 1, y: 0 };
    private visualSurfaceRotation = 0;
    private visualSurfaceEdgeId?: string;
    private normalAttachLockedUntil = 0;
    private normalSurfaceContactGraceUntil = 0;
    private normalSurfaceSwitchLockedUntil = 0;

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
        this.debugHudText = this.createTemporaryDebugHudText();
        this.updateTemporaryDirectionArrow();
        this.updateTemporaryInputDirectionArrow();
        this.updateTemporaryBackDirectionMarker();
        this.updateTemporaryDebugHudText();
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

        this.getTemporaryRecognizedAttachmentSurfaces();

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
        this.updateTemporaryDebugHudText();
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

        const supportingSurface = this.getTemporarySupportingSurface();
        const friction = supportingSurface
            ? this.getTemporaryShellGroundFriction()
            : TEMPORARY_SNAIL_CONTROL.shellAirFriction;

        this.snailMarker.setVelocityX(velocity.x * friction);
    }

    private getTemporaryShellGroundFriction(): number {
        return TEMPORARY_SNAIL_CONTROL.shellGroundFriction;
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
        const recognizedSurfaces = this.recognizedAttachmentSurfaces;
        const attachmentSurface = this.isTemporaryNormalAttachLocked()
            ? undefined
            : this.selectTemporaryNormalAttachmentSurface(
                  recognizedSurfaces,
                  moveDirection,
                  climbDirection,
              );

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
        const previousSurface = this.normalAttachmentSurface;

        this.snailMarker.setIgnoreGravity(true);
        this.normalAttachmentSurface = surface;
        this.refreshTemporaryNormalSurfaceContactGrace();
        this.lockTemporaryNormalSurfaceSwitch(previousSurface, surface);
        this.alignTemporaryMarkerBodyToSurface(surface);
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
        const input = this.getTemporaryWorldInputVector(moveDirection, climbDirection);
        const tangentInput = input.x * surface.tangent.x + input.y * surface.tangent.y;

        if (Math.abs(tangentInput) >= TEMPORARY_SNAIL_CONTROL.surfaceInputThreshold) {
            const amount = Math.sign(tangentInput);
            const speed = this.getTemporarySurfaceMoveSpeed(surface, amount, true);

            return {
                velocity: {
                    x: surface.tangent.x * amount * speed,
                    y: surface.tangent.y * amount * speed,
                },
                shouldUpdateFacing: true,
            };
        }

        const gravityProjection = this.getTemporarySurfaceGravityProjection(surface);

        if (Math.abs(gravityProjection) >= TEMPORARY_SNAIL_CONTROL.surfaceInputThreshold) {
            const amount = Math.sign(gravityProjection);
            const speed = this.getTemporarySurfaceMoveSpeed(surface, amount, false);

            return {
                velocity: {
                    x: surface.tangent.x * amount * speed,
                    y: surface.tangent.y * amount * speed,
                },
                shouldUpdateFacing: false,
            };
        }

        return {
            velocity: { x: 0, y: 0 },
            shouldUpdateFacing: false,
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

    private getTemporaryGravityVector(): Phaser.Types.Math.Vector2Like {
        return { x: 0, y: 1 };
    }

    private getTemporarySurfaceGravityProjection(surface: AttachmentSurface): number {
        const gravity = this.getTemporaryGravityVector();

        return surface.tangent.x * gravity.x + surface.tangent.y * gravity.y;
    }

    private isTemporarySurfaceAgainstGravity(surface: AttachmentSurface): boolean {
        const gravity = this.getTemporaryGravityVector();
        const normalGravityProjection = surface.normal.x * gravity.x + surface.normal.y * gravity.y;

        return normalGravityProjection <= -TEMPORARY_SNAIL_CONTROL.surfaceInputThreshold;
    }

    private getTemporarySurfaceMoveSpeed(
        surface: AttachmentSurface,
        amount: number,
        isManual: boolean,
    ): number {
        if (!isManual) {
            return TEMPORARY_SNAIL_CONTROL.normalPassiveSlideSpeed;
        }

        const gravityProjection =
            surface.tangent.x * amount * this.getTemporaryGravityVector().x +
            surface.tangent.y * amount * this.getTemporaryGravityVector().y;

        if (gravityProjection > TEMPORARY_SNAIL_CONTROL.surfaceInputThreshold) {
            return TEMPORARY_SNAIL_CONTROL.normalClimbDownSpeed;
        }

        if (gravityProjection < -TEMPORARY_SNAIL_CONTROL.surfaceInputThreshold) {
            return TEMPORARY_SNAIL_CONTROL.normalClimbSpeed;
        }

        return TEMPORARY_SNAIL_CONTROL.normalAttachMoveSpeed;
    }

    private selectTemporaryNormalAttachmentSurface(
        surfaces: AttachmentSurface[],
        moveDirection: number,
        climbDirection: number,
    ): AttachmentSurface | undefined {
        if (surfaces.length === 0) {
            if (this.normalAttachmentSurface && this.isTemporaryNormalSurfaceContactGraceActive()) {
                return this.normalAttachmentSurface;
            }

            return undefined;
        }

        const currentSurface = surfaces.find((surface) =>
            this.isSameTemporarySurface(surface, this.normalAttachmentSurface),
        );

        if (currentSurface && this.isTemporaryNormalSurfaceSwitchLocked()) {
            return currentSurface;
        }

        const stableCurrentSurface =
            currentSurface &&
            !this.isTemporaryInputPushingPastSurfaceEnd(
                currentSurface,
                moveDirection,
                climbDirection,
            )
                ? currentSurface
                : undefined;

        const inputSurface = this.getTemporaryInputAttachmentSurface(
            surfaces,
            moveDirection,
            climbDirection,
            stableCurrentSurface,
        );

        if (inputSurface) {
            return inputSurface;
        }

        if (currentSurface) {
            return currentSurface;
        }

        return surfaces.find((surface) => this.isTemporarySurfaceAgainstGravity(surface));
    }

    private getTemporaryRecognizedAttachmentSurfaces(): AttachmentSurface[] {
        if (!this.snailMarker) {
            this.recognizedAttachmentSurfaces = [];

            return this.recognizedAttachmentSurfaces;
        }

        this.recognizedAttachmentSurfaces = this.playfield.getAttachmentSurfaces(
            this.snailMarker,
            this.getTemporaryAttachmentProbe(),
            TEMPORARY_SNAIL_CONTROL.contactTolerance,
        );

        return this.recognizedAttachmentSurfaces;
    }

    private getTemporaryInputAttachmentSurface(
        surfaces: AttachmentSurface[],
        moveDirection: number,
        climbDirection: number,
        stableCurrentSurface?: AttachmentSurface,
    ): AttachmentSurface | undefined {
        const input = this.getTemporaryWorldInputVector(moveDirection, climbDirection);

        if (input.x === 0 && input.y === 0) {
            return undefined;
        }

        const candidates = surfaces
            .map((surface, index) => ({
                surface,
                index,
                projection: input.x * surface.tangent.x + input.y * surface.tangent.y,
            }))
            .filter(
                (candidate) =>
                    Math.abs(candidate.projection) >= TEMPORARY_SNAIL_CONTROL.surfaceInputThreshold,
            )
            .filter(
                (candidate) =>
                    !this.isTemporaryProjectionPushingPastSurfaceEnd(
                        candidate.surface,
                        candidate.projection,
                    ),
            );

        const bestCandidate = candidates.sort(
            (a, b) => Math.abs(b.projection) - Math.abs(a.projection) || a.index - b.index,
        )[0];

        if (!bestCandidate) {
            return undefined;
        }

        const currentCandidate = stableCurrentSurface
            ? candidates.find((candidate) =>
                  this.isSameTemporarySurface(candidate.surface, stableCurrentSurface),
              )
            : undefined;

        if (
            currentCandidate &&
            Math.abs(bestCandidate.projection) - Math.abs(currentCandidate.projection) <=
                TEMPORARY_SNAIL_CONTROL.surfaceSwitchProjectionMargin
        ) {
            return currentCandidate.surface;
        }

        return bestCandidate.surface;
    }

    private isTemporaryInputPushingPastSurfaceEnd(
        surface: AttachmentSurface,
        moveDirection: number,
        climbDirection: number,
    ): boolean {
        const input = this.getTemporaryWorldInputVector(moveDirection, climbDirection);
        const projection = input.x * surface.tangent.x + input.y * surface.tangent.y;

        return this.isTemporaryProjectionPushingPastSurfaceEnd(surface, projection);
    }

    private isTemporaryProjectionPushingPastSurfaceEnd(
        surface: AttachmentSurface,
        projection: number,
    ): boolean {
        if (Math.abs(projection) < TEMPORARY_SNAIL_CONTROL.surfaceInputThreshold) {
            return false;
        }

        if (projection > 0) {
            return surface.progress >= 1 - TEMPORARY_SNAIL_CONTROL.surfaceEndProgressTolerance;
        }

        return surface.progress <= TEMPORARY_SNAIL_CONTROL.surfaceEndProgressTolerance;
    }

    private isSameTemporarySurface(
        surface: AttachmentSurface,
        target?: AttachmentSurface,
    ): boolean {
        if (!target) {
            return false;
        }

        return surface.edgeId === target.edgeId;
    }

    private lockTemporaryNormalSurfaceSwitch(
        previousSurface: AttachmentSurface | undefined,
        nextSurface: AttachmentSurface,
    ): void {
        if (this.isSameTemporarySurface(nextSurface, previousSurface)) {
            return;
        }

        this.normalSurfaceSwitchLockedUntil =
            this.scene.time.now + TEMPORARY_SNAIL_CONTROL.surfaceSwitchLockMs;
    }

    private isTemporaryNormalSurfaceSwitchLocked(): boolean {
        return this.scene.time.now < this.normalSurfaceSwitchLockedUntil;
    }

    private refreshTemporaryNormalSurfaceContactGrace(): void {
        this.normalSurfaceContactGraceUntil =
            this.scene.time.now + TEMPORARY_SNAIL_CONTROL.surfaceContactGraceMs;
    }

    private isTemporaryNormalSurfaceContactGraceActive(): boolean {
        return this.scene.time.now < this.normalSurfaceContactGraceUntil;
    }

    private applyTemporaryShellSlopeBoost(
        moveDirection: number,
        surface: AttachmentSurface | undefined,
    ): void {
        if (!this.snailMarker || !surface) {
            return;
        }

        const gravityProjection = this.getTemporarySurfaceGravityProjection(surface);
        const downhill =
            gravityProjection > 0
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

        if (
            !surface ||
            !this.isTemporarySurfaceAgainstGravity(surface) ||
            Math.abs(this.getTemporarySurfaceGravityProjection(surface)) < 0.05
        ) {
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
        this.visualSurfaceEdgeId = undefined;
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

    private alignTemporaryMarkerBodyToSurface(surface: AttachmentSurface): void {
        if (!this.snailMarker) {
            return;
        }

        const surfaceAngle = Phaser.Math.RadToDeg(Math.atan2(surface.tangent.y, surface.tangent.x));

        this.snailMarker.setAngle(surfaceAngle);
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
                ? this.normalAttachmentSurface
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
                ? this.normalAttachmentSurface
                : this.getTemporarySupportingSurface();

        if (!surface) {
            if (this.snailMode === 'normal') {
                this.snailMarker.setAngle(0);
                this.visualSurfaceRotation = Phaser.Math.Angle.RotateTo(
                    this.visualSurfaceRotation,
                    0,
                    TEMPORARY_SNAIL_MARKER.surfaceRotationLerp,
                );
                this.visualSurfaceEdgeId = undefined;
            }

            return;
        }

        const surfaceRotation = Math.atan2(surface.tangent.y, surface.tangent.x);
        const surfaceAngle = Phaser.Math.RadToDeg(surfaceRotation);

        this.snailMarker.setAngle(surfaceAngle);

        if (surface.edgeId !== this.visualSurfaceEdgeId) {
            this.visualSurfaceRotation = surfaceRotation;
            this.visualSurfaceEdgeId = surface.edgeId;
            return;
        }

        this.visualSurfaceRotation = Phaser.Math.Angle.RotateTo(
            this.visualSurfaceRotation,
            surfaceRotation,
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
                ? this.normalAttachmentSurface
                : this.getTemporarySupportingSurface();

        if (surface) {
            return surface.normal;
        }

        return { x: 0, y: -1 };
    }

    private createTemporaryDebugHudText(): Phaser.GameObjects.Text {
        return this.scene.add
            .text(12, 12, '', {
                color: '#ffffff',
                fontFamily: 'monospace',
                fontSize: '14px',
                lineSpacing: 4,
                backgroundColor: 'rgba(20, 33, 61, 0.75)',
                padding: {
                    x: 8,
                    y: 6,
                },
            })
            .setDepth(100)
            .setScrollFactor(0);
    }

    private updateTemporaryDebugHudText(): void {
        const surface =
            this.snailMode === 'normal'
                ? this.normalAttachmentSurface
                : this.getTemporarySupportingSurface();
        const backDirection = this.getTemporaryBackDirection();
        const surfaceNormal = surface?.normal ?? { x: 0, y: 0 };
        const hudLines = [
            `mode: ${this.snailMode}`,
            `facing: ${this.formatTemporaryVector(this.facingDirection)}`,
            `back:   ${this.formatTemporaryVector(backDirection)}`,
            `selected: ${surface?.edgeId ?? 'none'}`,
            `selected normal: ${this.formatTemporaryVector(surfaceNormal)}`,
            `recognized: ${this.recognizedAttachmentSurfaces.length}`,
        ];

        this.recognizedAttachmentSurfaces.slice(0, 3).forEach((recognizedSurface, index) => {
            hudLines.push(
                `recognized ${index + 1}: ${recognizedSurface.edgeId}`,
                `  normal: ${this.formatTemporaryVector(recognizedSurface.normal)}`,
                `  tangent: ${this.formatTemporaryVector(recognizedSurface.tangent)}`,
            );
        });

        this.debugHudText.setText(hudLines);
    }

    private formatTemporaryVector(vector: Phaser.Types.Math.Vector2Like): string {
        return `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)})`;
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
