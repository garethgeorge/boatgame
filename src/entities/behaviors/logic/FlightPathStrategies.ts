import * as planck from 'planck';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalPathStrategy, AnimalSteering, AnimalStrategyContext } from './AnimalPathStrategy';

/**
 * BUZZ TARGET (Flight)
 */
export class BuzzTargetStrategy extends AnimalPathStrategy {
    readonly name = 'Buzzing';
    private lastDirectionUpdateTime: number = -1;
    private targetAngle: number = 0;
    private flightTime: number = 0;

    constructor(
        private maxHeight: number,
        private buzzHeight: number,
        private lockOnDistance: number,
        private horizSpeed: number
    ) {
        super();
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        this.flightTime += context.dt;

        const boatPos = context.targetBody.getPosition();
        const distToBoat = planck.Vec2.distance(context.originPos, boatPos);

        if (this.flightTime - this.lastDirectionUpdateTime > 1.0) {
            const dirToBoat = boatPos.clone().sub(context.originPos);
            const angleToBoat = Math.atan2(dirToBoat.x, -dirToBoat.y);
            this.targetAngle = distToBoat > this.lockOnDistance ? angleToBoat + (Math.random() - 0.5) * Math.PI * 0.5 : angleToBoat;
            this.lastDirectionUpdateTime = this.flightTime;
        }

        const flightDir = planck.Vec2(Math.sin(this.targetAngle), -Math.cos(this.targetAngle));
        return {
            target: context.originPos.clone().add(flightDir.mul(10)),
            speed: this.horizSpeed,
            height: distToBoat > 50.0 ? this.maxHeight : this.buzzHeight
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

    constructor(private maxHeight: number, private horizSpeed: number) { super(); }

    update(context: AnimalStrategyContext): AnimalSteering {
        this.flightTime += context.dt;

        if (this.flightTime - this.lastDirectionUpdateTime > 1.0) {
            const boatAngle = context.targetBody.getAngle();
            const offsetDeg = 30 + Math.random() * 20;
            this.targetAngle = boatAngle + (Math.random() < 0.5 ? -1 : 1) * (offsetDeg * Math.PI / 180.0);
            this.lastDirectionUpdateTime = this.flightTime;
        }

        const flightDir = planck.Vec2(Math.sin(this.targetAngle), -Math.cos(this.targetAngle));
        return {
            target: context.originPos.clone().add(flightDir.mul(10)),
            speed: this.horizSpeed,
            height: this.maxHeight
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
        private maxHeight: number,
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
        return {
            target: this.target,
            speed: this.horizSpeed,
            height: this.maxHeight
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
