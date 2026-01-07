import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalAttackParams } from '../AnimalBehaviorUtils';
import { AttackPathStrategy, SternInterceptStrategy, ShoreHuggingStrategy, AttackPathResult } from './AttackPathStrategies';
import { AttackLogic } from './AttackLogic';

type AmbushState = 'PREPARING' | 'STALKING' | 'STRIKING';

/**
 * "Ambush" attack logic: 
 * 1. Move toward the boat hugging the shore (STALKING).
 * 2. Strike the stern when the boat is close enough (STRIKING), 
 *    using relative velocity to determine the intercept point.
 */
export class AmbushAttackLogic extends AttackLogic {
    readonly name = 'ambush';
    private currentStrategy: AttackPathStrategy;
    private state: AmbushState = 'PREPARING';

    constructor() {
        super();
        this.currentStrategy = new ShoreHuggingStrategy();
    }

    override isPreparing(): boolean {
        return this.state === 'PREPARING';
    }

    override update(dt: number, originPos: planck.Vec2, attackPointWorld: planck.Vec2, animalBody: planck.Body, targetBody: planck.Body, aggressiveness: number, params: AnimalAttackParams) {
        if (this.state === 'PREPARING') {
            const result = this.currentStrategy.calculateTarget(originPos, attackPointWorld, targetBody, params);
            const diff = result.targetWorldPos.clone().sub(originPos);
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            const angleDiff = this.angleDifference(animalBody.getAngle(), desiredAngle);

            if (Math.abs(angleDiff) < 0.45) {
                this.state = 'STALKING';
            }
            return;
        }

        const localPos = targetBody.getLocalPoint(attackPointWorld);
        const longitudinalDist = localPos.y; // Positive is behind boat center

        // Calculate relative longitudinal velocity (how fast the boat is "passing" us or pulling away)
        const relVelWorld = animalBody.getLinearVelocity().clone().sub(targetBody.getLinearVelocity());
        const relVelLocal = targetBody.getLocalVector(relVelWorld);
        const relVelLong = relVelLocal.y; // Positive if animal is moving backward relative to boat

        // Dynamic threshold for switching to SternIntercept.
        // Match the tuned values from WolfAttackLogic
        const leadTime = 0.25; // seconds
        const baseThreshold = Boat.BOW_Y;
        const dynamicThreshold = baseThreshold - relVelLong * leadTime;

        switch (this.state) {
            case 'STALKING':
                // Move toward boat until we reach the striking threshold
                if (longitudinalDist > dynamicThreshold) {
                    this.state = 'STRIKING';
                    const interceptFactor = 0.4 + (aggressiveness * 0.6);
                    this.currentStrategy = new SternInterceptStrategy(interceptFactor);
                }
                break;

            case 'STRIKING':
                // Already in strike strategy
                break;
        }
    }

    private angleDifference(currentAngle: number, desiredAngle: number): number {
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
        return angleDiff;
    }

    override calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): AttackPathResult {
        return this.currentStrategy.calculateTarget(originPos, attackPointWorld, targetBody, params);
    }

    override shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): boolean {
        // In STRIKING, use the strategy's abort logic
        if (this.state === 'STRIKING') {
            return this.currentStrategy.shouldAbort(originPos, attackPointWorld, targetBody, params);
        }

        // In other states, abort if we are way behind the boat
        const localPos = targetBody.getLocalPoint(attackPointWorld);
        return localPos.y > Boat.STERN_Y + 15.0;
    }
}
