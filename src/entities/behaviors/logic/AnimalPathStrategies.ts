import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { RiverSystem } from '../../../world/RiverSystem';

/**
 * Result of any path strategy calculation.
 */
export interface AnimalPathResult {
    targetWorldPos: planck.Vec2;
    desiredSpeed: number;
    desiredHeight?: number;
    turningSpeed?: number;
    turningSmoothing?: number;
}

/**
 * Shared context for animal path strategies.
 */
export interface AnimalStrategyContext {
    dt: number;
    originPos: planck.Vec2;
    snoutPos: planck.Vec2;
    currentHeight: number;
    targetBody: planck.Body;
    aggressiveness: number;
    bottles: number;
}

/**
 * Universal base class for animal path strategies.
 * Provides default implementations for optional behavioral methods.
 */
export abstract class AnimalPathStrategy {
    abstract readonly name: string;

    /** Update strategy state prior to calculating path. */
    update(context: AnimalStrategyContext): void {
        // Default: No-op
    }

    /** Calculate the point that the animal should steer toward. */
    abstract calculatePath(context: AnimalStrategyContext): AnimalPathResult;

    /** Should this strategy be aborted because it no longer applies? */
    shouldAbort(context: AnimalStrategyContext): boolean {
        // Default: Don't abort
        return false;
    }
}

/**
 * STERN INTERCEPT (Water)
 */
export class SternInterceptStrategy extends AnimalPathStrategy {
    readonly name = 'SternIntercept';
    constructor(private interceptFactor: number = 0.5) { super(); }

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const localAttackPos = context.targetBody.getLocalPoint(context.snoutPos);
        const sternLocalY = (Boat.STERN_Y * 0.7 + Boat.FRONT_ZONE_END_Y * 0.3);
        const sternLocalX = localAttackPos.y < Boat.STERN_Y ? (localAttackPos.x < 0.0 ? -Boat.WIDTH * 0.4 : Boat.WIDTH * 0.4) : 0.0;
        const sternWorldPos = context.targetBody.getWorldPoint(planck.Vec2(sternLocalX, sternLocalY));
        const boatVel = context.targetBody.getLinearVelocity();
        const diff = sternWorldPos.clone().sub(context.snoutPos);
        const dist = diff.length();
        const dirToTarget = diff.clone();
        if (dist > 0.01) dirToTarget.normalize();

        const dotProd = planck.Vec2.dot(boatVel, dirToTarget);
        const lateralVel = boatVel.clone().sub(dirToTarget.clone().mul(dotProd));
        const lateralSpeed = lateralVel.length();

        let steeringDir: planck.Vec2 = lateralVel.clone().add(dirToTarget);
        if (lateralSpeed > params.attackSpeed) {
            steeringDir.normalize();
            steeringDir.mul(params.attackSpeed);
        } else {
            const closingSpeed = Math.sqrt(params.attackSpeed ** 2 - lateralSpeed ** 2);
            steeringDir = lateralVel.clone().add(dirToTarget.clone().mul(closingSpeed));
        }

        const targetWorldPos = planck.Vec2(
            sternWorldPos.x + (context.snoutPos.x + steeringDir.x - sternWorldPos.x) * this.interceptFactor,
            sternWorldPos.y + (context.snoutPos.y + steeringDir.y - sternWorldPos.y) * this.interceptFactor
        );

        return { targetWorldPos, desiredSpeed: params.attackSpeed, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }

    override shouldAbort(context: AnimalStrategyContext): boolean {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const boatSpeed = context.targetBody.getLinearVelocity().length();
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        return localPos.y > Boat.STERN_Y && boatSpeed > 0.5 * params.attackSpeed;
    }
}

/**
 * CIRCLE FLANK (Water)
 */
export class CircleFlankStrategy extends AnimalPathStrategy {
    readonly name = 'Flanking';
    private side: number;
    private flankOffsetMultiplier: number;

    constructor() {
        super();
        this.side = Math.random() > 0.5 ? 1 : -1;
        this.flankOffsetMultiplier = 3.0 + Math.random() * 2.0;
    }

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        if (localPos.x > 1.0) this.side = 1;
        else if (localPos.x < -1.0) this.side = -1;
        const flankLocal = planck.Vec2(this.side * Boat.WIDTH * this.flankOffsetMultiplier, Boat.STERN_Y * 0.2);

        return { targetWorldPos: context.targetBody.getWorldPoint(flankLocal), desiredSpeed: params.attackSpeed, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }

    override shouldAbort(context: AnimalStrategyContext): boolean {
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        return localPos.y > Boat.STERN_Y + 4.0;
    }
}

/**
 * VULNERABLE CHARGE (Water)
 */
export class VulnerableChargeStrategy extends AnimalPathStrategy {
    readonly name = 'Charging';
    constructor() { super(); }
    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        return { targetWorldPos: context.targetBody.getWorldPoint(planck.Vec2(0, Boat.STERN_Y)), desiredSpeed: params.attackSpeed, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }
}

/**
 * SHORE HUGGING (Water/Stalking)
 */
export class ShoreHuggingStrategy extends AnimalPathStrategy {
    readonly name = 'ShoreHugging';
    constructor() { super(); }
    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const boatPos = context.targetBody.getPosition();
        const riverSystem = RiverSystem.getInstance();
        if (!riverSystem) return { targetWorldPos: boatPos.clone(), desiredSpeed: params.attackSpeed };

        const targetY = context.originPos.y < boatPos.y ? context.originPos.y + 1.0 : context.originPos.y - 1.0;
        const banks = riverSystem.getBankPositions(targetY);
        const distToLeft = Math.abs(context.originPos.x - banks.left);
        const distToRight = Math.abs(context.originPos.x - banks.right);
        const targetX = distToLeft < distToRight ? banks.left + distToLeft : banks.right - distToRight;

        return { targetWorldPos: planck.Vec2(targetX, targetY), desiredSpeed: params.attackSpeed * 0.5, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }
}

/**
 * LURKING (Water)
 */
export class LurkingStrategy extends AnimalPathStrategy {
    readonly name = 'Lurking';
    constructor() { super(); }
    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        return { targetWorldPos: context.targetBody.getPosition(), desiredSpeed: 0, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }
}

/**
 * FLEE PATH (Water/Prey)
 */
export class FleePathStrategy extends AnimalPathStrategy {
    readonly name = 'Fleeing';
    private fleeAngle: number = 0;
    private timeSinceLastAngleChange: number = 0;

    constructor() { super(); }

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        const targetWorldPos = context.originPos.clone().add(planck.Vec2(Math.sin(this.fleeAngle), -Math.cos(this.fleeAngle)).mul(10));
        return { targetWorldPos, desiredSpeed: params.fleeSpeed, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }

    override update(context: AnimalStrategyContext) {
        this.timeSinceLastAngleChange += context.dt;
        if (this.timeSinceLastAngleChange > 2.0 || this.fleeAngle === 0) {
            const vel = context.targetBody.getLinearVelocity();
            const boatAngle = vel.length() > 0.5 ? Math.atan2(vel.y, vel.x) + Math.PI / 2 : context.targetBody.getAngle();
            this.fleeAngle = boatAngle + (Math.random() - 0.5) * Math.PI / 6;
            this.timeSinceLastAngleChange = 0;
        }
    }

    override shouldAbort(context: AnimalStrategyContext): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        const boatToAnimal = context.originPos.clone().sub(context.targetBody.getPosition());
        const isMovingTowards = planck.Vec2.dot(context.targetBody.getLinearVelocity(), boatToAnimal) > 0;
        return boatToAnimal.length() > params.stopFleeDistance || (context.targetBody.getLinearVelocity().length() > 0.5 && !isMovingTowards);
    }
}

/**
 * BUZZ TARGET (Flight)
 */
export class BuzzTargetStrategy extends AnimalPathStrategy {
    readonly name = 'Buzzing';
    private lastDirectionUpdateTime: number = -1;
    private targetAngle: number = 0;
    private flightTime: number = 0;

    constructor(private maxHeight: number, private buzzHeight: number, private lockOnDistance: number, private horizSpeed: number) { super(); }

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const boatPos = context.targetBody.getPosition();
        const distToBoat = planck.Vec2.distance(context.originPos, boatPos);

        if (this.flightTime - this.lastDirectionUpdateTime > 1.0) {
            const dirToBoat = boatPos.clone().sub(context.originPos);
            const angleToBoat = Math.atan2(dirToBoat.x, -dirToBoat.y);
            this.targetAngle = distToBoat > this.lockOnDistance ? angleToBoat + (Math.random() - 0.5) * Math.PI * 0.5 : angleToBoat;
            this.lastDirectionUpdateTime = this.flightTime;
        }

        const flightDir = planck.Vec2(Math.sin(this.targetAngle), -Math.cos(this.targetAngle));
        return { targetWorldPos: context.originPos.clone().add(flightDir.mul(10)), desiredHeight: distToBoat > 50.0 ? this.maxHeight : this.buzzHeight, desiredSpeed: this.horizSpeed };
    }

    override update(context: AnimalStrategyContext) { this.flightTime += context.dt; }
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

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        if (this.flightTime - this.lastDirectionUpdateTime > 1.0) {
            const boatAngle = context.targetBody.getAngle();
            const offsetDeg = 30 + Math.random() * 20;
            this.targetAngle = boatAngle + (Math.random() < 0.5 ? -1 : 1) * (offsetDeg * Math.PI / 180.0);
            this.lastDirectionUpdateTime = this.flightTime;
        }
        const flightDir = planck.Vec2(Math.sin(this.targetAngle), -Math.cos(this.targetAngle));
        return { targetWorldPos: context.originPos.clone().add(flightDir.mul(10)), desiredHeight: this.maxHeight, desiredSpeed: this.horizSpeed };
    }

    override update(context: AnimalStrategyContext) { this.flightTime += context.dt; }
}

/**
 * LANDING (Flight)
 */
export class LandingStrategy extends AnimalPathStrategy {
    readonly name = 'Landing';
    private landingAngle: number = 0;
    private landingStartAltitude: number = -1;

    constructor(private horizSpeed: number) { super(); }

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const groundHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(context.originPos.x, context.originPos.y);
        const currentAltitude = Math.max(0, context.currentHeight - groundHeight);

        if (this.landingStartAltitude < 0) {
            this.landingStartAltitude = currentAltitude;
            const derivative = RiverSystem.getInstance().getRiverDerivative(context.originPos.y);
            this.landingAngle = context.originPos.x < RiverSystem.getInstance().getBankPositions(context.originPos.y).left ? Math.atan2(1, derivative) : Math.atan2(-1, -derivative);
        }

        const speedFactor = Math.max(0, Math.min(1, currentAltitude / Math.max(0.1, this.landingStartAltitude)));
        const flightDir = planck.Vec2(Math.sin(this.landingAngle), -Math.cos(this.landingAngle));
        return { targetWorldPos: context.originPos.clone().add(flightDir.mul(10)), desiredHeight: 0, desiredSpeed: this.horizSpeed * speedFactor };
    }
}
