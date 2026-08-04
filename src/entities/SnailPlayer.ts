import Phaser from 'phaser';
import { SNAIL_CONTROL, SNAIL_MARKER } from '../config/gameConfig';
import { AttachmentProbe, AttachmentSurface, Playfield } from '../systems/Playfield';
import { SnailInputController } from '../systems/SnailInputController';

type SnailMode = 'normal' | 'shell';

type SnailMarker = Phaser.GameObjects.Shape &
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
    private snailMode: SnailMode = 'normal';
    private snailMarker?: SnailMarker;
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
    private slipperyKnockbackLockedUntil = 0;

    public constructor(
        private readonly scene: Phaser.Scene,
        private readonly playfield: Playfield,
        startPosition: Phaser.Types.Math.Vector2Like,
    ) {
        this.inputController = new SnailInputController(this.scene);
        this.createSnailMarker(this.snailMode, startPosition);
        this.directionArrow = this.scene.add.graphics();
        this.inputDirectionArrow = this.scene.add.graphics();
        this.backDirectionMarker = this.scene.add.graphics();
        this.debugHudText = this.createDebugHudText();
        this.updateDirectionArrow();
        this.updateInputDirectionArrow();
        this.updateBackDirectionMarker();
        this.updateDebugHudText();
        this.configureDebugMarkers();
    }

    public update(): void {
        this.updateSnailInput();
    }

    public getGameObject(): Phaser.GameObjects.GameObject {
        if (!this.snailMarker) {
            throw new Error('달팽이 마커가 아직 생성되지 않았다.');
        }

        return this.snailMarker;
    }

    public getPosition(): Phaser.Types.Math.Vector2Like {
        if (!this.snailMarker) {
            throw new Error('달팽이 마커가 아직 생성되지 않았다.');
        }

        return {
            x: this.snailMarker.x,
            y: this.snailMarker.y,
        };
    }

    private configureDebugMarkers(): void {
        this.directionArrow.setDepth(20);
        this.inputDirectionArrow.setDepth(21);
        this.backDirectionMarker.setDepth(22);
    }

    private updateSnailInput(): void {
        if (!this.snailMarker) {
            return;
        }

        if (this.inputController.isShellToggleJustDown()) {
            this.toggleSnailMode();
        }

        this.getRecognizedAttachmentSurfaces();

        if (this.snailMode === 'shell') {
            this.updateShellInput();
        } else {
            this.updateNormalInput();
        }

        this.alignMarkerToSurface();
        this.applyAirDownwardAcceleration();
        this.syncNormalVisual();
        this.updateDirectionArrow();
        this.updateInputDirectionArrow();
        this.updateBackDirectionMarker();
        this.updateDebugHudText();
    }

    private updateShellInput(): void {
        if (!this.snailMarker) {
            return;
        }

        const moveDirection = this.getMoveDirection();
        const supportSurface = this.getShellSlidingSupportSurface();
        const isGrounded = Boolean(this.getSupportingSurface());
        const canSteerShell = isGrounded || Boolean(supportSurface);

        if (moveDirection !== 0) {
            this.facingDirection = { x: moveDirection, y: 0 };
        }

        this.applyShellHorizontalAcceleration(moveDirection, canSteerShell);
        this.applyShellSurfaceGravityBoost(moveDirection, supportSurface);
        this.clampShellHorizontalSpeed();

        if (this.isJumpJustDown() && isGrounded) {
            this.snailMarker.setVelocity(
                this.snailMarker.getVelocity().x,
                SNAIL_CONTROL.shellJumpVelocity,
            );
        }
    }

    private applyShellHorizontalAcceleration(moveDirection: number, canSteerShell: boolean): void {
        if (!this.snailMarker) {
            return;
        }

        const velocity = this.snailMarker.getVelocity();

        if (moveDirection !== 0) {
            const acceleration = canSteerShell
                ? SNAIL_CONTROL.shellMoveAcceleration
                : SNAIL_CONTROL.shellAirMoveAcceleration;

            this.snailMarker.setVelocityX(velocity.x + moveDirection * acceleration);
            return;
        }

        const supportingSurface = this.getSupportingSurface();
        const friction = supportingSurface
            ? this.getShellGroundFriction()
            : SNAIL_CONTROL.shellAirFriction;

        this.snailMarker.setVelocityX(velocity.x * friction);
    }

    private getShellGroundFriction(): number {
        return SNAIL_CONTROL.shellGroundFriction;
    }

    private clampShellHorizontalSpeed(): void {
        if (!this.snailMarker) {
            return;
        }

        const velocity = this.snailMarker.getVelocity();
        const clampedVelocityX = Phaser.Math.Clamp(
            velocity.x,
            -SNAIL_CONTROL.shellMaxHorizontalSpeed,
            SNAIL_CONTROL.shellMaxHorizontalSpeed,
        );

        if (clampedVelocityX !== velocity.x) {
            this.snailMarker.setVelocityX(clampedVelocityX);
        }
    }

    private updateNormalInput(): void {
        if (!this.snailMarker) {
            return;
        }

        const moveDirection = this.getMoveDirection();
        const climbDirection = this.getClimbDirection();
        const recognizedSurfaces = this.recognizedAttachmentSurfaces;

        if (this.applySlipperySurfaceKnockback(recognizedSurfaces)) {
            return;
        }

        const attachmentSurface = this.isNormalAttachLocked()
            ? undefined
            : this.selectNormalAttachmentSurface(recognizedSurfaces, moveDirection, climbDirection);

        if (attachmentSurface) {
            this.updateAttachedNormalInput(attachmentSurface, moveDirection, climbDirection);
            return;
        }

        this.snailMarker.setIgnoreGravity(false);
        this.normalAttachmentSurface = undefined;

        if (moveDirection !== 0) {
            this.facingDirection = { x: moveDirection, y: 0 };
        }

        this.snailMarker.setVelocityX(moveDirection * SNAIL_CONTROL.normalMoveSpeed);
    }

    private getMoveDirection(): number {
        return this.inputController.getMoveDirection();
    }

    private getClimbDirection(): number {
        return this.inputController.getClimbDirection();
    }

    private updateAttachedNormalInput(
        surface: AttachmentSurface,
        moveDirection: number,
        climbDirection: number,
    ): void {
        if (!this.snailMarker) {
            return;
        }

        const movement = this.getSurfaceMovement(surface, moveDirection, climbDirection);
        const previousSurface = this.normalAttachmentSurface;

        this.snailMarker.setIgnoreGravity(true);
        this.normalAttachmentSurface = surface;
        this.refreshNormalSurfaceContactGrace();
        this.lockNormalSurfaceSwitch(previousSurface, surface);
        this.alignMarkerBodyToSurface(surface);
        this.snapNormalMarkerToSurface(surface);

        this.snailMarker.setVelocity(movement.velocity.x, movement.velocity.y);

        if (movement.shouldUpdateFacing) {
            this.facingDirection = this.normalizeVector(movement.velocity);
        }
    }

    private getSurfaceMovement(
        surface: AttachmentSurface,
        moveDirection: number,
        climbDirection: number,
    ): SurfaceMovement {
        const input = this.getWorldInputVector(moveDirection, climbDirection);
        const tangentInput = input.x * surface.tangent.x + input.y * surface.tangent.y;

        if (Math.abs(tangentInput) >= SNAIL_CONTROL.surfaceInputThreshold) {
            const amount = Math.sign(tangentInput);
            const speed = this.getSurfaceMoveSpeed(surface, amount, true);

            return {
                velocity: {
                    x: surface.tangent.x * amount * speed,
                    y: surface.tangent.y * amount * speed,
                },
                shouldUpdateFacing: true,
            };
        }

        const gravityProjection = this.getSurfaceGravityProjection(surface);

        if (Math.abs(gravityProjection) >= SNAIL_CONTROL.surfaceInputThreshold) {
            const amount = Math.sign(gravityProjection);
            const speed = this.getSurfaceMoveSpeed(surface, amount, false);

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

    private getWorldInputVector(
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

    private getGravityVector(): Phaser.Types.Math.Vector2Like {
        return { x: 0, y: 1 };
    }

    private getSurfaceGravityProjection(surface: AttachmentSurface): number {
        const gravity = this.getGravityVector();

        return surface.tangent.x * gravity.x + surface.tangent.y * gravity.y;
    }

    private isSurfaceAgainstGravity(surface: AttachmentSurface): boolean {
        const gravity = this.getGravityVector();
        const normalGravityProjection = surface.normal.x * gravity.x + surface.normal.y * gravity.y;

        return normalGravityProjection <= -SNAIL_CONTROL.surfaceInputThreshold;
    }

    private getSurfaceMoveSpeed(
        surface: AttachmentSurface,
        amount: number,
        isManual: boolean,
    ): number {
        if (!isManual) {
            return SNAIL_CONTROL.normalPassiveSlideSpeed;
        }

        const gravityProjection =
            surface.tangent.x * amount * this.getGravityVector().x +
            surface.tangent.y * amount * this.getGravityVector().y;

        if (gravityProjection > SNAIL_CONTROL.surfaceInputThreshold) {
            return SNAIL_CONTROL.normalClimbDownSpeed;
        }

        if (gravityProjection < -SNAIL_CONTROL.surfaceInputThreshold) {
            const targetVerticalSpeed = Math.min(
                SNAIL_CONTROL.normalClimbSpeed / Math.abs(gravityProjection),
                SNAIL_CONTROL.normalSlopeClimbMaxVerticalSpeed,
            );

            return Math.min(
                targetVerticalSpeed / Math.abs(gravityProjection),
                SNAIL_CONTROL.normalSlopeClimbMaxSpeed,
            );
        }

        return SNAIL_CONTROL.normalAttachMoveSpeed;
    }

    private selectNormalAttachmentSurface(
        surfaces: AttachmentSurface[],
        moveDirection: number,
        climbDirection: number,
    ): AttachmentSurface | undefined {
        if (surfaces.length === 0) {
            if (this.normalAttachmentSurface && this.isNormalSurfaceContactGraceActive()) {
                return this.normalAttachmentSurface;
            }

            return undefined;
        }

        const attachableSurfaces = surfaces.filter((surface) =>
            this.isNormalAttachableSurface(surface),
        );

        if (attachableSurfaces.length === 0) {
            return undefined;
        }

        const currentSurface = attachableSurfaces.find((surface) =>
            this.isSameSurface(surface, this.normalAttachmentSurface),
        );

        const stableCurrentSurface =
            currentSurface &&
            !this.isInputPushingPastSurfaceEnd(currentSurface, moveDirection, climbDirection)
                ? currentSurface
                : undefined;

        if (stableCurrentSurface && this.isNormalSurfaceSwitchLocked()) {
            return stableCurrentSurface;
        }

        const inputSurface = this.getInputAttachmentSurface(
            attachableSurfaces,
            moveDirection,
            climbDirection,
            stableCurrentSurface,
            currentSurface,
        );

        if (inputSurface) {
            return inputSurface;
        }

        const connectedSurface = this.getConnectedAttachmentSurface(
            attachableSurfaces,
            currentSurface,
            moveDirection,
            climbDirection,
        );

        if (connectedSurface) {
            return connectedSurface;
        }

        if (stableCurrentSurface) {
            return stableCurrentSurface;
        }

        return attachableSurfaces.find((surface) => this.isSurfaceAgainstGravity(surface));
    }

    private getRecognizedAttachmentSurfaces(): AttachmentSurface[] {
        if (!this.snailMarker) {
            this.recognizedAttachmentSurfaces = [];

            return this.recognizedAttachmentSurfaces;
        }

        this.recognizedAttachmentSurfaces = this.playfield.getAttachmentSurfaces(
            this.snailMarker,
            this.getAttachmentProbe(),
            SNAIL_CONTROL.contactTolerance,
        );

        return this.recognizedAttachmentSurfaces;
    }

    private applySlipperySurfaceKnockback(surfaces: AttachmentSurface[]): boolean {
        if (!this.snailMarker || this.scene.time.now < this.slipperyKnockbackLockedUntil) {
            return false;
        }

        const slipperySurface = surfaces.find(
            (surface) => !this.isNormalAttachableSurface(surface),
        );

        if (!slipperySurface) {
            return false;
        }

        const velocity = this.snailMarker.getVelocity();
        const nextVelocityX = slipperySurface.normal.x * SNAIL_CONTROL.slipperyKnockbackSpeed;
        const nextVelocityY = Math.max(
            velocity.y,
            slipperySurface.normal.y * SNAIL_CONTROL.slipperyKnockbackSpeed,
            SNAIL_CONTROL.slipperyKnockbackFallSpeed,
        );

        this.snailMarker.setIgnoreGravity(false);
        this.normalAttachmentSurface = undefined;
        this.normalAttachLockedUntil =
            this.scene.time.now + SNAIL_CONTROL.slipperyKnockbackCooldownMs;
        this.slipperyKnockbackLockedUntil =
            this.scene.time.now + SNAIL_CONTROL.slipperyKnockbackCooldownMs;
        this.snailMarker.setVelocity(nextVelocityX, nextVelocityY);

        return true;
    }

    private getInputAttachmentSurface(
        surfaces: AttachmentSurface[],
        moveDirection: number,
        climbDirection: number,
        stableCurrentSurface?: AttachmentSurface,
        currentSurface?: AttachmentSurface,
    ): AttachmentSurface | undefined {
        const input = this.getWorldInputVector(moveDirection, climbDirection);

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
                    Math.abs(candidate.projection) >= SNAIL_CONTROL.surfaceInputThreshold,
            )
            .filter(
                (candidate) =>
                    !this.isSameSurface(candidate.surface, currentSurface) ||
                    !this.isProjectionPushingPastSurfaceEnd(
                        candidate.surface,
                        candidate.projection,
                    ),
            );

        const entryCandidate = currentSurface
            ? this.getSurfaceEntryCandidate(candidates, currentSurface)
            : undefined;

        if (entryCandidate) {
            return entryCandidate.surface;
        }

        const bestCandidate = candidates.sort(
            (a, b) => Math.abs(b.projection) - Math.abs(a.projection) || a.index - b.index,
        )[0];

        if (!bestCandidate) {
            return undefined;
        }

        const currentCandidate = stableCurrentSurface
            ? candidates.find((candidate) =>
                  this.isSameSurface(candidate.surface, stableCurrentSurface),
              )
            : undefined;

        if (
            currentCandidate &&
            Math.abs(bestCandidate.projection) - Math.abs(currentCandidate.projection) <=
                SNAIL_CONTROL.surfaceSwitchProjectionMargin
        ) {
            return currentCandidate.surface;
        }

        return bestCandidate.surface;
    }

    private getSurfaceEntryCandidate(
        candidates: Array<{
            surface: AttachmentSurface;
            index: number;
            projection: number;
        }>,
        currentSurface: AttachmentSurface,
    ): { surface: AttachmentSurface; index: number; projection: number } | undefined {
        return candidates
            .filter((candidate) => !this.isSameSurface(candidate.surface, currentSurface))
            .filter((candidate) =>
                this.isInputEnteringSurfaceFromCurrentSurface(
                    candidate.surface,
                    currentSurface,
                    candidate.projection,
                ),
            )
            .sort(
                (a, b) =>
                    Math.abs(b.projection) - Math.abs(a.projection) ||
                    this.getNearestEndpointDistance(a.surface, currentSurface) -
                        this.getNearestEndpointDistance(b.surface, currentSurface) ||
                    a.index - b.index,
            )[0];
    }

    private isInputEnteringSurfaceFromCurrentSurface(
        surface: AttachmentSurface,
        currentSurface: AttachmentSurface,
        projection: number,
    ): boolean {
        if (Math.abs(projection) < SNAIL_CONTROL.surfaceInputThreshold) {
            return false;
        }

        const isNearStart =
            surface.progress <= SNAIL_CONTROL.surfaceEndProgressTolerance &&
            projection > 0 &&
            this.getSurfacePointDistance(currentSurface, surface.start) <=
                SNAIL_CONTROL.surfaceConnectionTolerance;
        const isNearEnd =
            surface.progress >= 1 - SNAIL_CONTROL.surfaceEndProgressTolerance &&
            projection < 0 &&
            this.getSurfacePointDistance(currentSurface, surface.end) <=
                SNAIL_CONTROL.surfaceConnectionTolerance;

        return isNearStart || isNearEnd;
    }

    private getNearestEndpointDistance(
        surface: AttachmentSurface,
        targetSurface: AttachmentSurface,
    ): number {
        return Math.min(
            this.getSurfacePointDistance(targetSurface, surface.start),
            this.getSurfacePointDistance(targetSurface, surface.end),
        );
    }

    private getConnectedAttachmentSurface(
        surfaces: AttachmentSurface[],
        currentSurface: AttachmentSurface | undefined,
        moveDirection: number,
        climbDirection: number,
    ): AttachmentSurface | undefined {
        if (!currentSurface) {
            return undefined;
        }

        const input = this.getWorldInputVector(moveDirection, climbDirection);
        const projection = input.x * currentSurface.tangent.x + input.y * currentSurface.tangent.y;

        if (!this.isProjectionPushingPastSurfaceEnd(currentSurface, projection)) {
            return undefined;
        }

        const connectionPoint = projection > 0 ? currentSurface.end : currentSurface.start;
        const connectedSurfaces = surfaces
            .filter((surface) => !this.isSameSurface(surface, currentSurface))
            .map((surface) => ({
                surface,
                distance: this.getSurfacePointDistance(surface, connectionPoint),
                directionProjection: this.getSurfaceDirectionProjection(surface, input),
            }))
            .filter(
                (candidate) =>
                    candidate.distance <= SNAIL_CONTROL.surfaceConnectionTolerance &&
                    candidate.directionProjection >= SNAIL_CONTROL.surfaceInputThreshold,
            );

        return connectedSurfaces.sort(
            (a, b) =>
                b.directionProjection - a.directionProjection ||
                a.distance - b.distance ||
                a.surface.edgeId.localeCompare(b.surface.edgeId),
        )[0]?.surface;
    }

    private getSurfaceDirectionProjection(
        surface: AttachmentSurface,
        input: Phaser.Types.Math.Vector2Like,
    ): number {
        const forwardProjection = input.x * surface.tangent.x + input.y * surface.tangent.y;
        const backwardProjection = -forwardProjection;

        return Math.max(forwardProjection, backwardProjection);
    }

    private getSurfacePointDistance(
        surface: AttachmentSurface,
        point: Phaser.Types.Math.Vector2Like,
    ): number {
        const surfaceVector = {
            x: surface.end.x - surface.start.x,
            y: surface.end.y - surface.start.y,
        };
        const surfaceLength = Math.hypot(surfaceVector.x, surfaceVector.y);

        if (surfaceLength <= 0) {
            return Number.POSITIVE_INFINITY;
        }

        const tangent = {
            x: surfaceVector.x / surfaceLength,
            y: surfaceVector.y / surfaceLength,
        };
        const delta = {
            x: point.x - surface.start.x,
            y: point.y - surface.start.y,
        };
        const tangentProjection = delta.x * tangent.x + delta.y * tangent.y;
        const tangentDistance = Math.min(Math.max(tangentProjection, 0), surfaceLength);
        const closestPoint = {
            x: surface.start.x + tangent.x * tangentDistance,
            y: surface.start.y + tangent.y * tangentDistance,
        };

        return Math.hypot(point.x - closestPoint.x, point.y - closestPoint.y);
    }

    private isInputPushingPastSurfaceEnd(
        surface: AttachmentSurface,
        moveDirection: number,
        climbDirection: number,
    ): boolean {
        const input = this.getWorldInputVector(moveDirection, climbDirection);
        const projection = input.x * surface.tangent.x + input.y * surface.tangent.y;

        return this.isProjectionPushingPastSurfaceEnd(surface, projection);
    }

    private isProjectionPushingPastSurfaceEnd(
        surface: AttachmentSurface,
        projection: number,
    ): boolean {
        if (Math.abs(projection) < SNAIL_CONTROL.surfaceInputThreshold) {
            return false;
        }

        if (projection > 0) {
            return surface.progress >= 1 - SNAIL_CONTROL.surfaceEndProgressTolerance;
        }

        return surface.progress <= SNAIL_CONTROL.surfaceEndProgressTolerance;
    }

    private isSameSurface(surface: AttachmentSurface, target?: AttachmentSurface): boolean {
        if (!target) {
            return false;
        }

        return surface.edgeId === target.edgeId;
    }

    private isNormalAttachableSurface(surface: AttachmentSurface): boolean {
        return surface.material !== 'slippery';
    }

    private lockNormalSurfaceSwitch(
        previousSurface: AttachmentSurface | undefined,
        nextSurface: AttachmentSurface,
    ): void {
        if (this.isSameSurface(nextSurface, previousSurface)) {
            return;
        }

        this.normalSurfaceSwitchLockedUntil =
            this.scene.time.now + SNAIL_CONTROL.surfaceSwitchLockMs;
    }

    private isNormalSurfaceSwitchLocked(): boolean {
        return this.scene.time.now < this.normalSurfaceSwitchLockedUntil;
    }

    private refreshNormalSurfaceContactGrace(): void {
        this.normalSurfaceContactGraceUntil =
            this.scene.time.now + SNAIL_CONTROL.surfaceContactGraceMs;
    }

    private isNormalSurfaceContactGraceActive(): boolean {
        return this.scene.time.now < this.normalSurfaceContactGraceUntil;
    }

    private applyShellSurfaceGravityBoost(
        moveDirection: number,
        surface: AttachmentSurface | undefined,
    ): void {
        if (!this.snailMarker || !surface) {
            return;
        }

        const gravityProjection = this.getSurfaceGravityProjection(surface);
        const downhill =
            gravityProjection > 0
                ? surface.tangent
                : {
                      x: -surface.tangent.x,
                      y: -surface.tangent.y,
                  };
        const acceleration =
            moveDirection === 0
                ? SNAIL_CONTROL.shellSlopePassiveAcceleration
                : SNAIL_CONTROL.shellSlopeInputAcceleration;
        const maxSpeed =
            moveDirection === 0
                ? SNAIL_CONTROL.shellSlopePassiveMaxSpeed
                : SNAIL_CONTROL.shellSlopeInputMaxSpeed;
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

    private getShellSlidingSupportSurface(): AttachmentSurface | undefined {
        const surface = this.getSupportingSurface();

        if (
            !surface ||
            !this.isSurfaceAgainstGravity(surface) ||
            Math.abs(this.getSurfaceGravityProjection(surface)) < 0.05
        ) {
            return undefined;
        }

        return surface;
    }

    private applyAirDownwardAcceleration(): void {
        if (!this.snailMarker || this.normalAttachmentSurface || this.getSupportingSurface()) {
            return;
        }

        const velocity = this.snailMarker.getVelocity();

        this.snailMarker.setVelocity(
            velocity.x,
            velocity.y + SNAIL_CONTROL.shortHopFallAcceleration,
        );
    }

    private isJumpJustDown(): boolean {
        return this.inputController.isJumpJustDown();
    }

    private toggleSnailMode(): void {
        if (!this.snailMarker) {
            return;
        }

        const previousMarker = this.snailMarker;
        const previousVelocity = previousMarker.getVelocity();
        const nextMode: SnailMode = this.snailMode === 'normal' ? 'shell' : 'normal';
        const position = {
            x: previousMarker.x,
            y: previousMarker.y,
        };

        this.destroyNormalVisual();
        previousMarker.destroy();
        this.snailMode = nextMode;
        this.normalAttachmentSurface = undefined;
        this.visualSurfaceEdgeId = undefined;
        this.normalAttachLockedUntil =
            nextMode === 'normal'
                ? this.scene.time.now + SNAIL_CONTROL.modeSwitchAttachCooldownMs
                : 0;
        this.createSnailMarker(nextMode, position);
        this.snailMarker?.setVelocity(previousVelocity.x, previousVelocity.y);
        this.syncNormalVisual();
        this.updateDirectionArrow();
        this.updateInputDirectionArrow();
        this.updateBackDirectionMarker();
    }

    private createSnailMarker(mode: SnailMode, position: Phaser.Types.Math.Vector2Like): void {
        const marker =
            mode === 'shell' ? this.createShellMarker(position) : this.createNormalMarker(position);

        this.snailMarker = marker;
    }

    private isNormalAttachLocked(): boolean {
        return this.scene.time.now < this.normalAttachLockedUntil;
    }

    private createNormalMarker(position: Phaser.Types.Math.Vector2Like): SnailMarker {
        const marker = this.scene.add.circle(
            position.x,
            position.y,
            1,
            SNAIL_MARKER.normalColor,
            0,
        );
        const radius = SNAIL_MARKER.normalSegmentRadius;
        const halfSpacing = SNAIL_MARKER.normalSegmentSpacing / 2;
        const frontBody = this.scene.matter.bodies.circle(
            position.x + halfSpacing,
            position.y,
            radius,
            {
                label: 'normal-snail-front-segment',
            },
        );
        const backBody = this.scene.matter.bodies.circle(
            position.x - halfSpacing,
            position.y,
            radius,
            {
                label: 'normal-snail-back-segment',
            },
        );
        const compoundBody = this.scene.matter.body.create({
            label: 'normal-snail-marker',
            parts: [frontBody, backBody],
            restitution: SNAIL_MARKER.restitution,
        });

        const matterMarker = this.scene.matter.add.gameObject(marker) as SnailMarker;

        matterMarker.setExistingBody(compoundBody);
        matterMarker.setFixedRotation();
        matterMarker.setIgnoreGravity(false);
        this.normalVisual = this.createNormalVisual(position);

        return matterMarker;
    }

    private snapNormalMarkerToSurface(surface: AttachmentSurface): void {
        if (!this.snailMarker) {
            return;
        }

        this.snailMarker.setPosition(surface.snapPosition.x, surface.snapPosition.y);
    }

    private alignMarkerBodyToSurface(surface: AttachmentSurface): void {
        if (!this.snailMarker) {
            return;
        }

        const surfaceAngle = Phaser.Math.RadToDeg(Math.atan2(surface.tangent.y, surface.tangent.x));

        this.snailMarker.setAngle(surfaceAngle);
    }

    private createShellMarker(position: Phaser.Types.Math.Vector2Like): SnailMarker {
        const marker = this.scene.add.circle(
            position.x,
            position.y,
            SNAIL_MARKER.shellRadius,
            SNAIL_MARKER.shellColor,
        );

        const matterMarker = this.scene.matter.add.gameObject(marker, {
            label: 'shell-snail-marker',
            shape: {
                type: 'circle',
                radius: SNAIL_MARKER.shellRadius,
            },
            restitution: SNAIL_MARKER.restitution,
        }) as SnailMarker;

        matterMarker.setIgnoreGravity(false);

        return matterMarker;
    }

    private createNormalVisual(
        position: Phaser.Types.Math.Vector2Like,
    ): Phaser.GameObjects.Container {
        const frontSegment = this.scene.add.circle(
            SNAIL_MARKER.normalSegmentSpacing / 2,
            0,
            SNAIL_MARKER.normalSegmentRadius,
            SNAIL_MARKER.normalColor,
        );
        const backSegment = this.scene.add.circle(
            -SNAIL_MARKER.normalSegmentSpacing / 2,
            0,
            SNAIL_MARKER.normalSegmentRadius,
            SNAIL_MARKER.normalBackColor,
        );
        const connector = this.scene.add.rectangle(
            0,
            0,
            SNAIL_MARKER.normalConnectorWidth,
            SNAIL_MARKER.normalConnectorHeight,
            SNAIL_MARKER.normalConnectorColor,
        );

        const visual = this.scene.add.container(position.x, position.y, [
            connector,
            backSegment,
            frontSegment,
        ]);

        visual.setDepth(10);

        return visual;
    }

    private syncNormalVisual(): void {
        if (!this.normalVisual || !this.snailMarker) {
            return;
        }

        this.normalVisual.setPosition(this.snailMarker.x, this.snailMarker.y);
        this.normalVisual.setRotation(this.visualSurfaceRotation);
        this.normalVisual.setScale(this.getNormalVisualDirectionScale(), 1);
    }

    private getNormalVisualDirectionScale(): number {
        if (!this.snailMarker) {
            return 1;
        }

        const surface =
            this.snailMode === 'normal'
                ? this.normalAttachmentSurface
                : this.getSupportingSurface();
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

    private destroyNormalVisual(): void {
        this.normalVisual?.destroy();
        this.normalVisual = undefined;
    }

    private alignMarkerToSurface(): void {
        if (!this.snailMarker) {
            return;
        }

        const surface =
            this.snailMode === 'normal'
                ? this.normalAttachmentSurface
                : this.getSupportingSurface();

        if (!surface) {
            if (this.snailMode === 'normal') {
                this.snailMarker.setAngle(0);
                this.visualSurfaceRotation = Phaser.Math.Angle.RotateTo(
                    this.visualSurfaceRotation,
                    0,
                    SNAIL_MARKER.surfaceRotationLerp,
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
            SNAIL_MARKER.surfaceRotationLerp,
        );
    }

    private updateDirectionArrow(): void {
        if (!this.snailMarker) {
            return;
        }

        const length = SNAIL_MARKER.directionArrowLength;
        const halfWidth = SNAIL_MARKER.directionArrowWidth / 2;
        const baseDistance = this.getSnailHalfSize() + SNAIL_MARKER.directionArrowGap;
        const tipDistance = baseDistance + length;
        const frontX = this.snailMarker.x + this.facingDirection.x * tipDistance;
        const frontY = this.snailMarker.y + this.facingDirection.y * tipDistance;
        const backCenterX = this.snailMarker.x + this.facingDirection.x * baseDistance;
        const backCenterY = this.snailMarker.y + this.facingDirection.y * baseDistance;
        const perpendicularX = -this.facingDirection.y;
        const perpendicularY = this.facingDirection.x;

        this.directionArrow.clear();
        this.directionArrow.fillStyle(SNAIL_MARKER.directionColor, 1);
        this.directionArrow.fillTriangle(
            frontX,
            frontY,
            backCenterX + perpendicularX * halfWidth,
            backCenterY + perpendicularY * halfWidth,
            backCenterX - perpendicularX * halfWidth,
            backCenterY - perpendicularY * halfWidth,
        );
    }

    private updateInputDirectionArrow(): void {
        if (!this.snailMarker) {
            return;
        }

        const inputDirection = this.getWorldInputVector(
            this.getMoveDirection(),
            this.getClimbDirection(),
        );

        this.inputDirectionArrow.clear();

        if (inputDirection.x === 0 && inputDirection.y === 0) {
            return;
        }

        this.drawDirectionTriangle(
            this.inputDirectionArrow,
            inputDirection,
            SNAIL_MARKER.inputDirectionColor,
            SNAIL_MARKER.inputArrowLength,
            SNAIL_MARKER.inputArrowWidth,
            this.getSnailHalfSize() + SNAIL_MARKER.directionArrowGap + 20,
        );
    }

    private updateBackDirectionMarker(): void {
        if (!this.snailMarker) {
            return;
        }

        const backDirection = this.getBackDirection();
        const startDistance = this.getSnailHalfSize() - 2;
        const startX = this.snailMarker.x + backDirection.x * startDistance;
        const startY = this.snailMarker.y + backDirection.y * startDistance;
        const endX =
            this.snailMarker.x + backDirection.x * (startDistance + SNAIL_MARKER.backMarkerLength);
        const endY =
            this.snailMarker.y + backDirection.y * (startDistance + SNAIL_MARKER.backMarkerLength);

        this.backDirectionMarker.clear();
        this.backDirectionMarker.lineStyle(
            SNAIL_MARKER.backMarkerWidth,
            SNAIL_MARKER.backDirectionColor,
            1,
        );
        this.backDirectionMarker.lineBetween(startX, startY, endX, endY);
    }

    private getBackDirection(): Phaser.Types.Math.Vector2Like {
        const surface =
            this.snailMode === 'normal'
                ? this.normalAttachmentSurface
                : this.getSupportingSurface();

        if (surface) {
            return surface.normal;
        }

        return { x: 0, y: -1 };
    }

    private createDebugHudText(): Phaser.GameObjects.Text {
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

    private updateDebugHudText(): void {
        const surface =
            this.snailMode === 'normal'
                ? this.normalAttachmentSurface
                : this.getSupportingSurface();
        const backDirection = this.getBackDirection();
        const surfaceNormal = surface?.normal ?? { x: 0, y: 0 };
        const hudLines = [
            `mode: ${this.snailMode}`,
            `facing: ${this.formatVector(this.facingDirection)}`,
            `back:   ${this.formatVector(backDirection)}`,
            `selected: ${surface?.edgeId ?? 'none'}`,
            `selected normal: ${this.formatVector(surfaceNormal)}`,
            `selected material: ${surface?.material ?? 'none'}`,
            `recognized: ${this.recognizedAttachmentSurfaces.length}`,
        ];

        this.recognizedAttachmentSurfaces.slice(0, 3).forEach((recognizedSurface, index) => {
            hudLines.push(
                `recognized ${index + 1}: ${recognizedSurface.edgeId}`,
                `  normal: ${this.formatVector(recognizedSurface.normal)}`,
                `  tangent: ${this.formatVector(recognizedSurface.tangent)}`,
                `  material: ${recognizedSurface.material}`,
            );
        });

        this.debugHudText.setText(hudLines);
    }

    private formatVector(vector: Phaser.Types.Math.Vector2Like): string {
        return `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)})`;
    }

    private drawDirectionTriangle(
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

    private getSupportingSurface(): AttachmentSurface | undefined {
        if (!this.snailMarker) {
            return undefined;
        }

        return this.playfield.getSupportingAttachmentSurface(
            this.snailMarker,
            this.getAttachmentProbe(),
            SNAIL_CONTROL.contactTolerance,
        );
    }

    private getAttachmentProbe(): AttachmentProbe {
        if (this.snailMode === 'shell') {
            return {
                tangentHalfLength: SNAIL_MARKER.shellRadius,
                normalHalfDepth: SNAIL_MARKER.shellRadius,
            };
        }

        return {
            tangentHalfLength:
                SNAIL_MARKER.normalSegmentSpacing / 2 + SNAIL_MARKER.normalSegmentRadius,
            normalHalfDepth: SNAIL_MARKER.normalSegmentRadius,
        };
    }

    private getSnailHalfSize(): number {
        return this.snailMode === 'shell'
            ? SNAIL_MARKER.shellRadius
            : SNAIL_MARKER.normalSegmentRadius;
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
