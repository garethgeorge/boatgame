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

    override update(dt: number, originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, aggressiveness: number) {
        this.strategyTimer -= dt;
        if (this.strategyTimer > 0) return;

        const localPos = targetBody.getLocalPoint(attackPointWorld);
        const longitudinalDist = localPos.y; // Positive is behind boat center

        // Switch to SternIntercept if we are in a good position to strike the back
        // e.g., on the flank and not too far ahead.
        if (longitudinalDist > Boat.BOW_Y - 1.0 * Boat.LENGTH) {
            if (this.currentStrategy.name !== 'SternIntercept') {
                const interceptFactor = 0.2 + (aggressiveness * 0.8);
                this.currentStrategy = new SternInterceptStrategy(interceptFactor);
                this.strategyTimer = 2.0; // Stay in this strategy for a bit
            }
        } else {
            // Positioning phase: randomly choose between flanking or a vulnerable charge
            if (Math.random() > 0.5) {
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
