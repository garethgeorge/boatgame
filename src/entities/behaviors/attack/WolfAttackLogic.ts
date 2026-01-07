import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalAttackParams } from '../AnimalBehaviorUtils';
import { AttackPathStrategy, SternInterceptStrategy, CircleFlankStrategy, VulnerableChargeStrategy, AttackPathResult } from './AttackPathStrategies';
import { AttackLogic } from './AttackLogic';

/**
 * "Wolf" attack logic: Flank the boat from the side before striking the stern.
 */
export class WolfAttackLogic extends AttackLogic {
    readonly name = 'wolf';
    private currentStrategy: AttackPathStrategy;
    private strategyTimer: number = 0;

    constructor() {
        super();
        this.currentStrategy = new CircleFlankStrategy();
    }

    override update(dt: number, originPos: planck.Vec2, attackPointWorld: planck.Vec2, animalBody: planck.Body, targetBody: planck.Body, aggressiveness: number, params: AnimalAttackParams) {
        this.strategyTimer -= dt;

        const localPos = targetBody.getLocalPoint(attackPointWorld);
        const longitudinalDist = localPos.y; // Positive is behind boat center

        // Calculate relative longitudinal velocity (how fast the boat is "passing" us or pulling away)
        const relVelWorld = animalBody.getLinearVelocity().clone().sub(targetBody.getLinearVelocity());
        const relVelLocal = targetBody.getLocalVector(relVelWorld);
        const relVelLong = relVelLocal.y; // Positive if animal is moving backward relative to boat

        // Dynamic threshold for switching to SternIntercept.
        // Base threshold: we are behind the bow (Boat.BOW_Y = -3). 
        // We add a lead time to account for the time it takes to turn and accelerate.
        const leadTime = 0.25; // seconds
        const baseThreshold = Boat.BOW_Y;
        const dynamicThreshold = baseThreshold - relVelLong * leadTime;

        // Switch to SternIntercept if we are in a good position to strike the back
        if (longitudinalDist > dynamicThreshold) {
            if (this.currentStrategy.name !== 'SternIntercept') {
                const interceptFactor = 0.2 + (aggressiveness * 0.8);
                this.currentStrategy = new SternInterceptStrategy(interceptFactor);
                this.strategyTimer = 2.0; // Stay in this strategy for a bit
            }
        } else if (this.strategyTimer < 0) {
            // Positioning phase: randomly choose between flanking or a vulnerable charge
            if (Math.random() < 0.67) {
                this.currentStrategy = new CircleFlankStrategy();
            } else {
                this.currentStrategy = new VulnerableChargeStrategy();
            }
            this.strategyTimer = 1.5 + Math.random() * 2.0;
        }
    }

    override calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): AttackPathResult {
        return this.currentStrategy.calculateTarget(originPos, attackPointWorld, targetBody, params);
    }

    override shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): boolean {
        return this.currentStrategy.shouldAbort(originPos, attackPointWorld, targetBody, params);
    }
}
