import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalAttackParams } from '../AnimalBehaviorUtils';

/**
 * Interface for animal attack path strategies.
 * Defines how an animal chooses its target position relative to the boat.
 */
export interface AttackPathStrategy {
    readonly name: string;

    /**
     * Calculates the world-space target position for the animal.
     * @param animalPos Current position of the animal
     * @param boatBody Physics body of the boat
     * @param params Attack parameters
     */
    calculateTarget(animalPos: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): planck.Vec2;
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

    calculateTarget(animalPos: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): planck.Vec2 {
        // Target a point near the stern center
        const sternLocalY = (Boat.STERN_Y + Boat.FRONT_ZONE_END_Y) / 2.0;
        const sternWorldPos = boatBody.getWorldPoint(planck.Vec2(0, sternLocalY));
        const boatVel = boatBody.getLinearVelocity();

        const diff = sternWorldPos.clone().sub(animalPos);
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
        const interceptPos = animalPos.clone().add(steeringDir);

        // Interpolate between current target (stern) and intercept point based on intelligence
        return planck.Vec2(
            sternWorldPos.x + (interceptPos.x - sternWorldPos.x) * this.interceptFactor,
            sternWorldPos.y + (interceptPos.y - sternWorldPos.y) * this.interceptFactor
        );
    }
}

/**
 * Strategy that circles around the boat's side (The "Wolf" Strategy).
 * It targets a point offset from the boat to flank it before striking.
 */
export class CircleFlankStrategy implements AttackPathStrategy {
    readonly name = 'Flanking';

    private side: number;

    constructor() {
        // Randomly pick a side if not already flanking
        this.side = Math.random() > 0.5 ? 1 : -1;
    }

    calculateTarget(animalPos: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): planck.Vec2 {
        const localPos = boatBody.getLocalPoint(animalPos);

        // If we are already significantly on one side, stick to it
        if (Math.abs(localPos.x) > 2.0) {
            this.side = localPos.x > 0 ? 1 : -1;
        }

        // Target a point 5-8 units to the side of the boat, and slightly ahead of the stern
        // This creates an "arcing" approach.
        const flankOffsetMultiplier = 3.0 + Math.random() * 2.0;
        const flankLocal = planck.Vec2(this.side * Boat.WIDTH * flankOffsetMultiplier, Boat.STERN_Y * 0.2);

        return boatBody.getWorldPoint(flankLocal);
    }
}

/**
 * Strategy that charging directly at the stern, often crossing the bow's path.
 * This makes the animal vulnerable to being rammed.
 */
export class VulnerableChargeStrategy implements AttackPathStrategy {
    readonly name = 'Charging';

    calculateTarget(animalPos: planck.Vec2, boatBody: planck.Body, params: AnimalAttackParams): planck.Vec2 {
        // Direct charge at the stern tip - no prediction, just meat-headed charge
        const sternLocalY = Boat.STERN_Y;
        return boatBody.getWorldPoint(planck.Vec2(0, sternLocalY));
    }
}
