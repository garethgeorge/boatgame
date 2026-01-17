import * as planck from 'planck';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalSteering } from './AnimalPathStrategy';
import { dir, log } from 'node:console';

/**
 * 0: Face Toward river
 * 1: Face Upstream (+Z)
 * 2: Face Away from river
 * 3: Face Downstream (-Z)
 */
export type TurnDirection = 0 | 1 | 2 | 3;
export type WalkDirection = 'upstream' | 'downstream';

export class ShoreTurnStrategy extends AnimalPathStrategy {
    readonly name = 'ShoreTurn';

    private isOnLeftBank: boolean = true;
    private targetAngle: number = 0;

    constructor(
        private readonly startPos: planck.Vec2,
        private readonly direction: TurnDirection,
        private readonly rotationSpeed: number,
        private readonly onFinish: () => void
    ) {
        super();
        this.initialize(startPos);
    }

    private initialize(pos: planck.Vec2) {
        const riverSystem = RiverSystem.getInstance();
        const banks = riverSystem.getBankPositions(pos.y);
        const distFromLeft = Math.abs(pos.x - banks.left);
        const distFromRight = Math.abs(pos.x - banks.right);
        this.isOnLeftBank = distFromLeft < distFromRight;
        this.targetAngle = this.calculateAngle(riverSystem, pos);
    }

    private calculateAngle(riverSystem: RiverSystem, pos: planck.Vec2): number {
        // Upstream (+Z) -> +Y in Physics (pi/2)
        // Downstream (-Z) -> -Y in Physics (-pi/2)
        // Right Bank Shore (+X) -> 0
        // Left Bank Shore (-X) -> pi
        // this is the angle for facing up river (animal angle is wrt y axis)
        const dx = riverSystem.getRiverDerivative(pos.y);
        const angle = Math.atan2(1.0, dx) + Math.PI / 2;

        switch (this.direction) {
            case 1: // Upstream (+Z)
                return angle;
            case 3: // Downstream (-Z). This is the default facing direction for animals
                return angle + Math.PI;
            case 0: // Face river
                return angle + (this.isOnLeftBank ? -Math.PI / 2 : Math.PI / 2);
            case 2: // Face away
                return angle + (this.isOnLeftBank ? Math.PI / 2 : -Math.PI / 2);
        }
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const currentAngle = context.physicsBody.getAngle();
        const diff = Math.atan2(Math.sin(this.targetAngle - currentAngle), Math.cos(this.targetAngle - currentAngle));

        if (Math.abs(diff) < 0.1) {
            this.onFinish();
        }

        return {
            kind: 'STEERING',
            data: {
                target: context.originPos, // Stay in place
                speed: 0,
                turningSpeed: this.rotationSpeed,
                facing: {
                    angle: this.targetAngle, // Let physics/sync handle the rotation
                    normal: new planck.Vec2(0, 1) // Default up normal
                }
            }
        };
    }
}

export class ShoreWalkStrategy extends AnimalPathStrategy {
    readonly name = 'ShoreWalk';

    public isOnLeftBank: boolean = true;
    private bankDistance: number = 0;
    private lastPos: planck.Vec2;
    private distanceTravelled: number;

    constructor(
        private readonly startPos: planck.Vec2,
        private readonly direction: WalkDirection,
        private readonly distance: number,
        private readonly speed: number,
        private readonly onFinish: () => void
    ) {
        super();
        this.initialize(startPos);
    }

    private initialize(pos: planck.Vec2) {
        this.lastPos = pos.clone();
        this.distanceTravelled = 0;

        const banks = RiverSystem.getInstance().getBankPositions(pos.y);
        const distFromLeft = Math.abs(pos.x - banks.left);
        const distFromRight = Math.abs(pos.x - banks.right);

        if (distFromLeft < distFromRight) {
            this.isOnLeftBank = true;
            this.bankDistance = distFromLeft;
        } else {
            this.isOnLeftBank = false;
            this.bankDistance = distFromRight;
        }
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const currentPos = context.originPos;

        // Calculate progress
        this.distanceTravelled += planck.Vec2.distance(currentPos, this.lastPos);
        this.lastPos.setVec2(currentPos);

        if (this.distanceTravelled >= this.distance) {
            this.onFinish();
        }

        // Determine target
        const riverSystem = RiverSystem.getInstance();
        const directionSign = this.direction === 'upstream' ? 1 : -1;

        const targetY = currentPos.y + directionSign * 4.0;
        const banks = riverSystem.getBankPositions(targetY);
        const targetX = this.isOnLeftBank ?
            banks.left - this.bankDistance : banks.right + this.bankDistance;
        const targetWorldPos = new planck.Vec2(targetX, targetY);

        // Calculate desired angle relative to the y axis since
        // that's what animal angle is wrt
        const dx = targetWorldPos.x - currentPos.x;
        const dy = targetWorldPos.y - currentPos.y;
        const desiredAngle = Math.atan2(dy, dx) + Math.PI / 2;

        const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(currentPos.x, currentPos.y);

        return {
            kind: 'STEERING',
            data: {
                target: targetWorldPos,
                speed: this.speed,
                height: terrainHeight,
                facing: {
                    angle: desiredAngle
                }
            }
        };
    }

}
