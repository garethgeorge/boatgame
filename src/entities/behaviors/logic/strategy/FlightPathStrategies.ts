import * as planck from 'planck';
import { RiverSystem } from '../../../../world/RiverSystem';
import { AnimalPathStrategy, AnimalSteering, AnimalStrategyContext } from './AnimalPathStrategy';
import { AnimalBehaviorUtils } from '../../AnimalBehaviorUtils';

/**
 * BUZZ TARGET (Flight)
 */
export class BuzzTargetStrategy extends AnimalPathStrategy {
    readonly name = 'Buzzing';
    private flightTime: number = 0;

    constructor(
        private flightHeight: number,
        private buzzHeight: number,
        private horizSpeed: number,
        private targetOffset: number = 0, // Offset to "lead" the boat
    ) {
        super();
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        this.flightTime += context.dt;

        // Target a point ahead of the boat in local coordinates
        // Bow is at -3.0y, Stern at +3.0y. Positive targetOffset = front = negative y.
        const targetPoint = context.targetBody.getWorldPoint(planck.Vec2(0, -this.targetOffset));
        const distToTarget = AnimalBehaviorUtils.distance(context.originPos, targetPoint);

        const diffToTarget = targetPoint.clone().sub(context.originPos);
        const targetAngle = Math.atan2(diffToTarget.x, -diffToTarget.y);
        const currentAngle = context.physicsBody.getAngle();
        const alignment = AnimalBehaviorUtils.calculateAlignmentSpeedScaling(currentAngle, targetAngle);

        return {
            target: targetPoint,
            speed: this.horizSpeed * alignment,
            height: distToTarget > 50.0 ? this.flightHeight : this.buzzHeight,
        };
    }
}

/**
 * FLEE RIVER (Flight)
 */
export class FleeRiverStrategy extends AnimalPathStrategy {
    readonly name = 'Fleeing';
    private targetAngle: number = 0;
    private lastDirectionUpdateTime: number = -1;
    private flightTime: number = 0;

    constructor(private flightHeight: number, private horizSpeed: number) { super(); }

    update(context: AnimalStrategyContext): AnimalSteering {
        this.flightTime += context.dt;

        const currentAngle = context.physicsBody.getAngle();
        const alignment = AnimalBehaviorUtils.calculateAlignmentSpeedScaling(currentAngle, this.targetAngle);

        const flightDir = planck.Vec2(Math.sin(this.targetAngle), -Math.cos(this.targetAngle));
        return {
            target: context.originPos.clone().add(flightDir.mul(10)),
            speed: this.horizSpeed * alignment,
            height: this.flightHeight,
        };
    }
}

/**
 * FLY TO SHORE (Flight)
 * Moves directly to the nearest shore.
 */
export class FlyToShoreStrategy extends AnimalPathStrategy {
    readonly name = 'Flying to Shore';
    private target: planck.Vec2;

    constructor(
        currentPos: planck.Vec2,
        private flightHeight: number,
        private horizSpeed: number,
        private zRange: [number, number]
    ) {
        super();

        const [zMin, zMax] = this.zRange;
        const xMargin = 40.0;
        const xMarginSize = 20.0;
        const zMargin = 20.0;
        const zMarginSize = 40.0;

        const banks = RiverSystem.getInstance().getBankPositions(currentPos.y);

        // Aim for a position well onto the closest shore
        const isOnLeftSide = currentPos.x < (banks.left + banks.right) / 2;
        const targetX = isOnLeftSide ?
            banks.left - (xMargin + Math.random() * xMarginSize) :
            banks.right + (xMargin + Math.random() * xMarginSize);

        // Pick a point a little inside the z range
        const isAtStart = currentPos.y < (zMin + zMax) / 2;
        const targetZ = isAtStart ?
            zMin + (zMargin + Math.random() * zMarginSize) :
            zMax - (zMargin + Math.random() * zMarginSize);

        this.target = new planck.Vec2(targetX, targetZ);
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const diffToTarget = this.target.clone().sub(context.originPos);
        const targetAngle = Math.atan2(diffToTarget.x, -diffToTarget.y);
        const currentAngle = context.physicsBody.getAngle();
        const alignment = AnimalBehaviorUtils.calculateAlignmentSpeedScaling(currentAngle, targetAngle);

        return {
            target: this.target,
            speed: this.horizSpeed * alignment,
            height: this.flightHeight,
        };
    }
}

/**
 * LANDING (Flight)
 */
export class LandingStrategy extends AnimalPathStrategy {
    readonly name = 'Landing';
    private landingAngle: number = 0;
    private landingStartAltitude: number = -1;

    constructor(private horizSpeed: number) { super(); }

    update(context: AnimalStrategyContext): AnimalSteering {
        const groundHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(context.originPos.x, context.originPos.y);
        const currentAltitude = Math.max(0, context.currentHeight - groundHeight);

        if (this.landingStartAltitude < 0) {
            this.landingStartAltitude = currentAltitude;
            const derivative = RiverSystem.getInstance().getRiverDerivative(context.originPos.y);
            this.landingAngle = context.originPos.x < RiverSystem.getInstance().getBankPositions(context.originPos.y).left ? Math.atan2(1, derivative) : Math.atan2(-1, -derivative);
        }

        const speedFactor = Math.max(0, Math.min(1, currentAltitude / Math.max(0.1, this.landingStartAltitude)));
        const flightDir = planck.Vec2(Math.sin(this.landingAngle), -Math.cos(this.landingAngle));
        return {
            target: context.originPos.clone().add(flightDir.mul(10)),
            speed: this.horizSpeed * speedFactor,
            height: 0
        };
    }
}

/**
 * WATER LANDING (Flight)
 */
export class WaterLandingStrategy extends AnimalPathStrategy {
    readonly name = 'Water Landing';
    private landingStartAltitude: number = -1;
    private readonly lookAhead: number = 30.0;
    private readonly minShoreHeight: number = 8.0;

    constructor(private horizSpeed: number, private landingHeight: number = 0.0) { super(); }

    update(context: AnimalStrategyContext): AnimalSteering {
        const riverSystem = RiverSystem.getInstance();

        // Target is the center of the river at a point ahead in the current flight direction
        const angle = context.physicsBody.getAngle();
        const moveDir = new planck.Vec2(-Math.sin(angle), -Math.cos(angle));

        const targetZ = context.originPos.y + moveDir.y * this.lookAhead;
        const banks = riverSystem.getBankPositions(targetZ);
        const center = (banks.left + banks.right) / 2;
        const targetWorldPos = new planck.Vec2(center, targetZ);

        // Ground information at current position
        const groundHeight = riverSystem.terrainGeometry.calculateHeight(context.originPos.x, context.originPos.y);
        const currentBanks = riverSystem.getBankPositions(context.originPos.y);
        const isOverWater = context.originPos.x > currentBanks.left && context.originPos.x < currentBanks.right;

        // Altitude relative to ground/water
        const currentAltitude = Math.max(0, context.currentHeight - (isOverWater ? 0 : groundHeight));

        if (this.landingStartAltitude < 0) {
            this.landingStartAltitude = currentAltitude;
        }

        let targetHeight = 0.0;
        let speedFactor = 1.0;

        if (!isOverWater) {
            // Over land: stay at least minShoreHeight up
            targetHeight = groundHeight + this.minShoreHeight;
            speedFactor = 1.0;
        } else {
            // Over water: descend to landingHeight
            targetHeight = this.landingHeight;
            // Slow down as we approach the final destination altitude
            const totalDrop = Math.max(0.1, this.landingStartAltitude - this.landingHeight);
            const currentDropRemaining = Math.max(0, context.currentHeight - this.landingHeight);
            speedFactor = Math.max(0.2, Math.min(1.0, currentDropRemaining / totalDrop));
        }

        return {
            target: targetWorldPos,
            speed: this.horizSpeed * speedFactor,
            height: targetHeight,
        };
    }
}

/**
 * WANDER (Flight)
 * Moves essentially randomly around a center point.
 */
export class WanderStrategy extends AnimalPathStrategy {
    readonly name = 'Wandering';
    private target: planck.Vec2;
    private lastUpdateTime: number = -1;

    constructor(
        private center: planck.Vec2,
        private radius: number,
        private speed: number,
        private height: number,
    ) {
        super();
        this.target = this.center.clone();
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const distToTarget = AnimalBehaviorUtils.distance(context.originPos, this.target);

        // Pick new target if reached or periodically
        if (distToTarget < 2.0 || context.dt + this.lastUpdateTime > 5.0 || this.lastUpdateTime < 0) {
            const angle = Math.random() * Math.PI * 2;
            const dist = this.radius;
            this.target = new planck.Vec2(
                this.center.x + Math.sin(angle) * dist,
                this.center.y - Math.cos(angle) * dist
            );
            this.lastUpdateTime = 0;
        } else {
            this.lastUpdateTime += context.dt;
        }

        const diffToTarget = this.target.clone().sub(context.originPos);
        const targetAngle = Math.atan2(diffToTarget.x, -diffToTarget.y);
        const currentAngle = context.physicsBody.getAngle();
        const alignment = AnimalBehaviorUtils.calculateAlignmentSpeedScaling(currentAngle, targetAngle);

        return {
            target: this.target,
            speed: this.speed * alignment,
            height: this.height,
        };
    }

    setCenter(center: planck.Vec2) {
        this.center = center;
    }
}

/**
 * FLY TO POINT (Flight)
 * Moves directly to a specific target point.
 */
export class FlyToPointStrategy extends AnimalPathStrategy {
    readonly name = 'Flying to Point';

    constructor(
        private target: planck.Vec2,
        private speed: number,
        private height: number,
    ) {
        super();
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const diffToTarget = this.target.clone().sub(context.originPos);
        const targetAngle = Math.atan2(diffToTarget.x, -diffToTarget.y);
        const currentAngle = context.physicsBody.getAngle();
        const alignment = AnimalBehaviorUtils.calculateAlignmentSpeedScaling(currentAngle, targetAngle);

        return {
            target: this.target,
            speed: this.speed * alignment,
            height: this.height
        };
    }
}
