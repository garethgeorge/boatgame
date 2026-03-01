import * as planck from 'planck';
import * as THREE from 'three';
import { TerrainMap } from '../../TerrainMap';
import { AnimalPathStrategy, AnimalSteering, AnimalStrategyContext } from './AnimalPathStrategy';
import { AnimalBehaviorUtils } from '../../AnimalBehaviorUtils';
import { CoreMath } from '../../../../core/CoreMath';

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
            locomotionType: 'FLIGHT',
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
            locomotionType: 'FLIGHT',
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
        terrainMap: TerrainMap,
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

        const shoreline = terrainMap.getNearestShoreline(currentPos.x, currentPos.y);

        // Aim for a position well onto the closest shore
        const marginDist = xMargin + Math.random() * xMarginSize;
        const targetX = shoreline.position.x - shoreline.normal.x * marginDist;

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
            locomotionType: 'FLIGHT',
        };
    }
}

/**
 * POINT LANDING (Flight)
 * Lands on a specific 3D point (target and height).
 */
export class PointLandingStrategy extends AnimalPathStrategy {
    readonly name = 'Point Landing';


    private horizSpeed: number;
    private target: planck.Vec2;
    private targetHeight: number;
    private flightHeight: number;

    private landingDir: planck.Vec2;
    private approachTarget: planck.Vec2;
    private approachHeight: number;

    private landingStartDist: number;
    private landingStartHeight: number;
    private state: 'FLY' | 'APPROACH' | 'LANDING' = 'FLY';

    constructor(
        context: AnimalStrategyContext,
        horizSpeed: number,
        target: planck.Vec2,
        targetHeight: number,
        flightHeight: number
    ) {
        super();

        this.horizSpeed = horizSpeed;
        this.target = target;
        this.targetHeight = targetHeight;
        this.flightHeight = flightHeight;

        // --- Landing Path Calculation ---
        const terrainMap = context.animal.getTerrainMap();
        const shoreline = terrainMap.getNearestShoreline(this.target.x, this.target.y);

        // Direction from target TO water is exactly the normal given by ShoreInfo (normal points into water)
        this.landingDir = new planck.Vec2(shoreline.normal.x, shoreline.normal.y);
        this.landingDir.normalize();

        // A point on the landing path away from the river
        const approachDistance = 20.0;
        this.approachTarget = planck.Vec2.sub(this.target, this.landingDir.clone().mul(approachDistance));
        this.approachHeight = this.targetHeight + 5.0;
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const horizDist = planck.Vec2.distance(context.originPos, this.target);

        // --- State Management ---
        switch (this.state) {
            case 'FLY': {
                const distToApproach = planck.Vec2.distance(context.originPos, this.approachTarget);
                if (distToApproach < 10.0)
                    this.state = 'APPROACH';
                break;
            }
            case 'APPROACH': {
                const distToApproach = planck.Vec2.distance(context.originPos, this.approachTarget);
                if (distToApproach < 1.0) {
                    this.state = 'LANDING';
                    this.landingStartDist = horizDist;
                    this.landingStartHeight = context.currentHeight;
                }
                break;
            }
        }

        let target = undefined;
        let targetHeight = undefined;
        let speedFactor = 1.0;

        // --- Execution ---
        switch (this.state) {
            case 'FLY': {
                target = this.approachTarget;
                targetHeight = this.flightHeight;
                break;
            }
            case 'APPROACH': {
                target = this.approachTarget;
                targetHeight = this.approachHeight;
                break;
            }
            case 'LANDING': {
                target = this.target;
                targetHeight = this.targetHeight;
                // Guide the landing in smoothly
                if (this.landingStartDist > 0.0) {
                    const progress = Math.pow(horizDist / this.landingStartDist, 0.5);
                    speedFactor = CoreMath.clamp(0.1, 1.0, progress);
                    if (horizDist > 0.5) {
                        targetHeight = CoreMath.lerp(targetHeight, this.landingStartHeight, progress);
                    }
                }
                break;
            }
        }

        return {
            target: target!,
            speed: this.horizSpeed * speedFactor,
            height: targetHeight,
            locomotionType: 'FLIGHT'
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
        const terrainMap = context.animal.getTerrainMap();

        // Target is a point ahead in the current flight direction, but aligned with the water flow
        const angle = context.physicsBody.getAngle();
        const moveDir = new planck.Vec2(-Math.sin(angle), -Math.cos(angle));

        const flowDir = terrainMap.getNearestWaterFlow(context.originPos.x, context.originPos.y);

        const targetWorldPos = new planck.Vec2(
            context.originPos.x + flowDir.x * this.lookAhead,
            context.originPos.y + flowDir.y * this.lookAhead
        );

        // Ground information at current position
        const surfaceInfo = terrainMap.getSurfaceInfo(context.originPos.x, context.originPos.y);
        const groundHeight = surfaceInfo.y;
        const isOverWater = surfaceInfo.zone === 'water';

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
            locomotionType: 'FLIGHT',
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
            locomotionType: 'FLIGHT',
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
            height: this.height,
            locomotionType: 'FLIGHT'
        };
    }
}
