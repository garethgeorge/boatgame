import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils, AnimalAttackParams } from '../AnimalBehaviorUtils';
import { RiverSystem } from '../../../world/RiverSystem';

/**
 * Result of a strategy calculation, including target position, desired movement speed,
 * and locomotion dynamics.
 */
export interface AnimalPathResult {
    targetWorldPos: planck.Vec2;
    desiredSpeed: number;
    turningSpeed: number;
    turningSmoothing: number;
}

/**
 * Interface for animal path strategies.
 * Defines how an animal chooses its target position and movement dynamics.
 */
export interface AnimalPathStrategy {
    readonly name: string;

    /**
     * Calculates the target position and movement parameters.
     */
    calculatePath(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): AnimalPathResult;

    /**
     * Returns true if the strategy is no longer viable.
     */
    shouldAbort(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): boolean;
}

/**
 * Strategy that tries to intercept the boat's stern by predicting its movement.
 */
export class SternInterceptStrategy implements AnimalPathStrategy {
    readonly name = 'SternIntercept';

    constructor(private interceptFactor: number = 0.5) { }

    calculatePath(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(aggressiveness, bottles, 30);

        const localAttackPos = targetBody.getLocalPoint(snoutPos);
        const sternLocalY = (Boat.STERN_Y * 0.7 + Boat.FRONT_ZONE_END_Y * 0.3);
        const sternLocalX = localAttackPos.y < Boat.STERN_Y ?
            (localAttackPos.x < 0.0 ? -Boat.WIDTH * 0.4 : Boat.WIDTH * 0.4) : 0.0;
        const sternWorldPos = targetBody.getWorldPoint(planck.Vec2(sternLocalX, sternLocalY));
        const boatVel = targetBody.getLinearVelocity();
        const diff = sternWorldPos.clone().sub(snoutPos);
        const dist = diff.length();
        const dirToTarget = diff.clone();
        if (dist > 0.01) dirToTarget.normalize();

        const dotProd = planck.Vec2.dot(boatVel, dirToTarget);
        const lateralVel = boatVel.clone().sub(dirToTarget.clone().mul(dotProd));
        const lateralSpeed = lateralVel.length();

        let steeringDir: planck.Vec2;

        if (lateralSpeed > params.attackSpeed) {
            steeringDir = lateralVel.clone().add(dirToTarget);
            steeringDir.normalize();
            steeringDir.mul(params.attackSpeed);
        } else {
            const closingSpeed = Math.sqrt(params.attackSpeed ** 2 - lateralSpeed ** 2);
            steeringDir = lateralVel.clone().add(dirToTarget.clone().mul(closingSpeed));
        }

        const calculatedInterceptPos = snoutPos.clone().add(steeringDir);

        const targetWorldPos = planck.Vec2(
            sternWorldPos.x + (calculatedInterceptPos.x - sternWorldPos.x) * this.interceptFactor,
            sternWorldPos.y + (calculatedInterceptPos.y - sternWorldPos.y) * this.interceptFactor
        );

        return {
            targetWorldPos,
            desiredSpeed: params.attackSpeed,
            turningSpeed: params.turningSpeed,
            turningSmoothing: params.turningSmoothing
        };
    }

    shouldAbort(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): boolean {
        const params = AnimalBehaviorUtils.evaluateAttackParams(aggressiveness, bottles, 30);
        const boatSpeed = targetBody.getLinearVelocity().length();
        const localPos = targetBody.getLocalPoint(snoutPos);
        return localPos.y > Boat.STERN_Y && boatSpeed > 0.5 * params.attackSpeed;
    }
}

/**
 * Strategy that circles around the boat's side.
 */
export class CircleFlankStrategy implements AnimalPathStrategy {
    readonly name = 'Flanking';

    private side: number;
    private flankOffsetMultiplier: number;

    constructor() {
        this.side = Math.random() > 0.5 ? 1 : -1;
        this.flankOffsetMultiplier = 3.0 + Math.random() * 2.0;
    }

    calculatePath(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(aggressiveness, bottles, 30);
        const localPos = targetBody.getLocalPoint(snoutPos);

        if (localPos.x > 1.0) this.side = 1;
        if (localPos.x < -1.0) this.side = -1;
        else this.side = localPos.x > 0 ? 1 : -1;

        const flankLocal = planck.Vec2(this.side * Boat.WIDTH * this.flankOffsetMultiplier, Boat.STERN_Y * 0.2);

        return {
            targetWorldPos: targetBody.getWorldPoint(flankLocal),
            desiredSpeed: params.attackSpeed,
            turningSpeed: params.turningSpeed,
            turningSmoothing: params.turningSmoothing
        };
    }

    shouldAbort(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): boolean {
        const localPos = targetBody.getLocalPoint(snoutPos);
        return localPos.y > Boat.STERN_Y + 4.0;
    }
}

/**
 * Strategy that charging directly at the stern.
 */
export class VulnerableChargeStrategy implements AnimalPathStrategy {
    readonly name = 'Charging';

    calculatePath(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(aggressiveness, bottles, 30);
        const sternLocalY = Boat.STERN_Y;
        return {
            targetWorldPos: targetBody.getWorldPoint(planck.Vec2(0, sternLocalY)),
            desiredSpeed: params.attackSpeed,
            turningSpeed: params.turningSpeed,
            turningSmoothing: params.turningSmoothing
        };
    }

    shouldAbort(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): boolean {
        const localPos = targetBody.getLocalPoint(snoutPos);
        return localPos.y > Boat.STERN_Y + 2.0;
    }
}

/**
 * Strategy that targets a point near the river bank.
 */
export class ShoreHuggingStrategy implements AnimalPathStrategy {
    readonly name = 'ShoreHugging';

    calculatePath(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(aggressiveness, bottles, 30);
        const boatPos = targetBody.getPosition();
        const riverSystem = RiverSystem.getInstance();

        if (!riverSystem) {
            return {
                targetWorldPos: boatPos.clone(),
                desiredSpeed: params.attackSpeed,
                turningSpeed: params.turningSpeed,
                turningSmoothing: params.turningSmoothing
            };
        }

        const targetY = originPos.y < boatPos.y ? originPos.y + 1.0 : originPos.y - 1.0;
        const banks = riverSystem.getBankPositions(targetY);
        const distToLeft = Math.abs(originPos.x - banks.left);
        const distToRight = Math.abs(originPos.x - banks.right);
        const targetX = distToLeft < distToRight ? banks.left + distToLeft : banks.right - distToRight;

        return {
            targetWorldPos: planck.Vec2(targetX, targetY),
            desiredSpeed: params.attackSpeed * 0.5,
            turningSpeed: params.turningSpeed,
            turningSmoothing: params.turningSmoothing
        };
    }

    shouldAbort(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): boolean {
        const localPos = targetBody.getLocalPoint(snoutPos);
        return localPos.y > Boat.STERN_Y;
    }
}

/**
 * Strategy that keeps the animal stationary but facing the boat.
 */
export class LurkingStrategy implements AnimalPathStrategy {
    readonly name = 'Lurking';

    calculatePath(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(aggressiveness, bottles, 30);
        const boatPos = targetBody.getPosition();
        return {
            targetWorldPos: boatPos.clone(),
            desiredSpeed: 0,
            turningSpeed: params.turningSpeed,
            turningSmoothing: params.turningSmoothing
        };
    }

    shouldAbort(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): boolean {
        const localPos = targetBody.getLocalPoint(snoutPos);
        return localPos.y > Boat.STERN_Y;
    }
}

/**
 * Strategy that calculates a direction away from the boat.
 */
export class FleePathStrategy implements AnimalPathStrategy {
    readonly name = 'Fleeing';
    private fleeAngle: number = 0;
    private timeSinceLastAngleChange: number = 0;
    private readonly angleChangeInterval: number = 2.0;

    calculatePath(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(aggressiveness, bottles);
        const targetWorldPos = originPos.clone().add(planck.Vec2(Math.sin(this.fleeAngle), -Math.cos(this.fleeAngle)).mul(10));

        return {
            targetWorldPos,
            desiredSpeed: params.fleeSpeed,
            turningSpeed: params.turningSpeed,
            turningSmoothing: params.turningSmoothing
        };
    }

    updateAngle(dt: number, targetBody: planck.Body) {
        this.timeSinceLastAngleChange += dt;
        if (this.timeSinceLastAngleChange > this.angleChangeInterval || this.fleeAngle === 0) {
            const vel = targetBody.getLinearVelocity();
            let boatAngle = targetBody.getAngle();

            if (vel.length() > 0.5) {
                boatAngle = Math.atan2(vel.y, vel.x) + Math.PI / 2;
            }

            const variance = (Math.random() - 0.5) * Math.PI / 6;
            this.fleeAngle = boatAngle + variance;
            this.timeSinceLastAngleChange = 0;
        }
    }

    shouldAbort(originPos: planck.Vec2, snoutPos: planck.Vec2, targetBody: planck.Body, aggressiveness: number, bottles: number): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(aggressiveness, bottles);
        const boatVel = targetBody.getLinearVelocity();
        const boatToAnimal = originPos.clone().sub(targetBody.getPosition());
        const isMoving = boatVel.lengthSquared() > 0.5;
        const isMovingTowards = isMoving && planck.Vec2.dot(boatVel, boatToAnimal) > 0;

        const dist = boatToAnimal.length();
        return dist > params.stopFleeDistance || !isMovingTowards;
    }
}
