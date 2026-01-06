import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalAttackParams } from '../AnimalBehaviorUtils';
import { AttackPathStrategy, SternInterceptStrategy, CircleFlankStrategy } from './AttackPathStrategies';
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

    override update(dt: number, attackPointWorld: planck.Vec2, targetBody: planck.Body, aggressiveness: number) {
        this.strategyTimer -= dt;
        if (this.strategyTimer > 0) return;

        const localPos = targetBody.getLocalPoint(attackPointWorld);
        const longitudinalDist = localPos.y; // Positive is behind boat center

        // Switch to SternIntercept if we are in a good position to strike the back
        // e.g., on the flank and not too far ahead.
        if (longitudinalDist > Boat.BOW_Y - 0 * Boat.LENGTH) {
            if (this.currentStrategy.name !== 'SternIntercept') {
                const interceptFactor = 0.2 + (aggressiveness * 0.8);
                this.currentStrategy = new SternInterceptStrategy(interceptFactor);
                this.strategyTimer = 2.0; // Stay in this strategy for a bit
            }
        } else {
            if (this.currentStrategy.name !== 'Flanking') {
                this.currentStrategy = new CircleFlankStrategy();
                this.strategyTimer = 1.0 + Math.random();
            }
        }
    }

    override calculateTarget(attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): planck.Vec2 {
        return this.currentStrategy.calculateTarget(attackPointWorld, targetBody, params);
    }
}
