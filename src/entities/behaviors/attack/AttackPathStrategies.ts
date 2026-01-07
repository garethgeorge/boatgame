import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalAttackParams } from '../AnimalBehaviorUtils';
import { RiverSystem } from '../../../world/RiverSystem';

/**
 * Result of a strategy calculation, including target position and desired movement speed.
 */
export interface AttackPathResult {
    targetWorldPos: planck.Vec2;
    desiredSpeed: number;
}

/**
 * Interface for animal attack path strategies.
 * Defines how an animal chooses its target position relative to the boat.
 */
export interface AttackPathStrategy {
    readonly name: string;

    /**
     * Calculates the target position and speed for the animal.
     * @param originPos Center/Pivot of the animal
     * @param attackPointWorld Interaction point (snout) of the animal
     * @param boatBody Physics body of the boat
     * @param params Attack parameters
     */
    calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): AttackPathResult;

    /**
     * Returns true if the strategy is no longer viable (e.g. overshot or outpaced).
     */
    shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): boolean;
}

/**
 * Strategy that tries to intercept the boat's stern by predicting its movement.
 */
export class SternInterceptStrategy implements AttackPathStrategy {
    readonly name = 'SternIntercept';

    /**
     * @param interceptFactor How much of the prediction to apply (0-1).
     * 0 = no prediction, 1 = full intercept.
     */
    constructor(private interceptFactor: number = 0.5) { }

    calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): AttackPathResult {
        // Target a point near the stern center in y and on the same side
        // as the attack point unless we're behind the boat
        const localAttackPos = boatBody.getLocalPoint(attackPointWorld);
        const sternLocalY = (Boat.STERN_Y * 0.7 + Boat.FRONT_ZONE_END_Y * 0.3);
        const sternLocalX = localAttackPos.y < Boat.STERN_Y ?
            (localAttackPos.x < 0.0 ? -Boat.WIDTH * 0.4 : Boat.WIDTH * 0.4) : 0.0;
        const sternWorldPos = boatBody.getWorldPoint(planck.Vec2(sternLocalX, sternLocalY));
        const boatVel = boatBody.getLinearVelocity();
        const diff = sternWorldPos.clone().sub(attackPointWorld);
        const dist = diff.length();
        const dirToTarget = diff.clone();
        if (dist > 0.01) dirToTarget.normalize();

        // 1. Find the component of the boat's velocity perpendicular to the animal (lateral escaping speed)
        const dotProd = planck.Vec2.dot(boatVel, dirToTarget);
        const lateralVel = boatVel.clone().sub(dirToTarget.clone().mul(dotProd));
        const lateralSpeed = lateralVel.length();

        let steeringDir: planck.Vec2;

        if (lateralSpeed > params.attackSpeed) {
            // Boat is too fast sideways; animal just chases as best it can
            steeringDir = lateralVel.clone().add(dirToTarget);
            steeringDir.normalize();
            steeringDir.mul(params.attackSpeed);
        } else {
            // 2. Match the lateral speed and use the 'leftover' speed to close the gap
            // Pythagorean theorem: closingSpeed^2 + lateralSpeed^2 = params.attackSpeed^2
            const closingSpeed = Math.sqrt(params.attackSpeed ** 2 - lateralSpeed ** 2);
            steeringDir = lateralVel.clone().add(dirToTarget.clone().mul(closingSpeed));
        }

        // The point we steer towards to achieve this velocity
        const calculatedInterceptPos = attackPointWorld.clone().add(steeringDir);

        // Interpolate between current target (stern) and intercept point based on intelligence
        const targetWorldPos = planck.Vec2(
            sternWorldPos.x + (calculatedInterceptPos.x - sternWorldPos.x) * this.interceptFactor,
            sternWorldPos.y + (calculatedInterceptPos.y - sternWorldPos.y) * this.interceptFactor
        );

        return {
            targetWorldPos,
            desiredSpeed: params.attackSpeed
        };
    }

    shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): boolean {
        const boatSpeed = boatBody.getLinearVelocity().length();
        const localPos = boatBody.getLocalPoint(attackPointWorld);
        // If we are behind the stern and the boat is faster, we'll never catch it.
        return localPos.y > Boat.STERN_Y && boatSpeed > 0.5 * params.attackSpeed;
    }
}

/**
 * Strategy that circles around the boat's side (The "Wolf" Strategy).
 * It targets a point offset from the boat to flank it before striking.
 */
export class CircleFlankStrategy implements AttackPathStrategy {
    readonly name = 'Flanking';

    private side: number;
    private flankOffsetMultiplier: number;

    constructor() {
        // Randomly pick a side if not already flanking
        this.side = Math.random() > 0.5 ? 1 : -1;
        this.flankOffsetMultiplier = 3.0 + Math.random() * 2.0;
    }

    calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): AttackPathResult {
        const localPos = boatBody.getLocalPoint(attackPointWorld);

        // If we are already significantly on one side, stick to it
        if (localPos.x > 1.0) this.side = 1;
        if (localPos.x < -1.0) this.side = -1;
        else this.side = localPos.x > 0 ? 1 : -1;

        // Target a point 5-8 units to the side of the boat, and slightly ahead of the stern
        // This creates an "arcing" approach.
        const flankLocal = planck.Vec2(this.side * Boat.WIDTH * this.flankOffsetMultiplier, Boat.STERN_Y * 0.2);

        return {
            targetWorldPos: boatBody.getWorldPoint(flankLocal),
            desiredSpeed: params.attackSpeed
        };
    }

    shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): boolean {
        const localPos = boatBody.getLocalPoint(attackPointWorld);
        // If we've overshot the stern significantly, the flank is a failure.
        return localPos.y > Boat.STERN_Y + 4.0;
    }
}

/**
 * Strategy that charging directly at the stern, often crossing the bow's path.
 * This makes the animal vulnerable to being rammed.
 */
export class VulnerableChargeStrategy implements AttackPathStrategy {
    readonly name = 'Charging';

    calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): AttackPathResult {
        // Direct charge at the stern tip - no prediction, just meat-headed charge
        const sternLocalY = Boat.STERN_Y;
        return {
            targetWorldPos: boatBody.getWorldPoint(planck.Vec2(0, sternLocalY)),
            desiredSpeed: params.attackSpeed
        };
    }

    shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): boolean {
        const localPos = boatBody.getLocalPoint(attackPointWorld);
        // Direct charges are easily overshot if the boat moves.
        return localPos.y > Boat.STERN_Y + 2.0;
    }
}

/**
 * Strategy that targets a point near the river bank.
 * It chooses the bank nearest to its current position and stays a few units away from the edge.
 */
export class ShoreHuggingStrategy implements AttackPathStrategy {
    readonly name = 'ShoreHugging';

    constructor() { }

    calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): AttackPathResult {
        const boatPos = boatBody.getPosition();
        const riverSystem = RiverSystem.getInstance();

        // Default to a sane position if river system is somehow missing
        if (!riverSystem) {
            return {
                targetWorldPos: boatPos.clone(),
                desiredSpeed: params.attackSpeed
            };
        }


        // Target a point nearer to the boat and close to a bank
        const targetY = originPos.y < boatPos.y ? originPos.y + 1.0 : originPos.y - 1.0;

        const banks = riverSystem.getBankPositions(targetY);
        const distToLeft = Math.abs(originPos.x - banks.left);
        const distToRight = Math.abs(originPos.x - banks.right);
        const targetX = distToLeft < distToRight ? banks.left + distToLeft : banks.right - distToRight;

        // Move slower
        return {
            targetWorldPos: planck.Vec2(targetX, targetY),
            desiredSpeed: params.attackSpeed * 0.5
        };
    }

    shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): boolean {
        const localPos = boatBody.getLocalPoint(attackPointWorld);
        return localPos.y > Boat.STERN_Y;
    }
}

/**
 * Strategy that keeps the animal stationary but facing the boat.
 */
export class LurkingStrategy implements AttackPathStrategy {
    readonly name = 'Lurking';

    calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): AttackPathResult {
        // We stay stationary at our current position
        // The rotation logic in moveTowardPoint will still use the vector from origin to boatPos
        // to face the boat, even though desiredSpeed is 0.
        const boatPos = boatBody.getPosition();
        return {
            targetWorldPos: boatPos.clone(),
            desiredSpeed: 0
        };
    }

    shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): boolean {
        const localPos = boatBody.getLocalPoint(attackPointWorld);
        // If the boat has passed us, we are no longer lurking in ambush.
        return localPos.y > Boat.STERN_Y;
    }
}
