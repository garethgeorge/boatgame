import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { ShoreHuggingStrategy, SternInterceptStrategy } from './strategy/AttackPathStrategies';

/**
 * Ambush logic runs forever.
 */
export class AmbushAttackLogic implements AnimalLogic {
    readonly name = 'AmbushAttack';

    private currentStrategy: AnimalPathStrategy;
    private state: 'IDLE' | 'PREPARING' | 'STALKING' | 'STRIKING' = 'IDLE';

    constructor() {
        this.currentStrategy = new ShoreHuggingStrategy();
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {

        // See whether to engage/disengage attack
        if (this.state == 'IDLE') {
            if (this.shouldEngage(context)) {
                this.state = 'PREPARING';
            }
        } else {
            if (this.shouldDisengage(context)) {
                this.state = 'IDLE';
            }
        }
        if (this.state == 'IDLE') {
            return {
                path: {
                    target: context.originPos,
                    speed: 0
                },
                locomotionType: 'WATER',
            }
        }

        // See if it is time to switch to a new strategy, switch to striking
        // if gap to boat will close in less than 0.25 seconds
        const relativeVelocity = context.targetBody.getLocalVector(
            context.physicsBody.getLinearVelocity().clone().sub(
                context.targetBody.getLinearVelocity()
            )).y;
        if (this.state === 'STALKING' &&
            context.targetBody.getLocalPoint(context.snoutPos).y > Boat.BOW_Y - relativeVelocity * 0.25) {
            this.state = 'STRIKING';
            this.currentStrategy = new SternInterceptStrategy(0.4 + (context.aggressiveness * 0.6));
        }

        // Determine the next target
        const steering = this.currentStrategy.update(context);

        // Decide if preparatory phase is done
        if (this.state === 'PREPARING') {
            const diff = steering.target.clone().sub(context.originPos);
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            let angleDiff = desiredAngle - context.physicsBody.getAngle();
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            if (Math.abs(angleDiff) < 0.45) this.state = 'STALKING';
        }

        return {
            path: steering,
            locomotionType: 'WATER',
        };
    }

    getPhase(): AnimalLogicPhase {
        switch (this.state) {
            case 'IDLE': return AnimalLogicPhase.IDLE_WATER;
            case 'PREPARING': return AnimalLogicPhase.PREPARING_ATTACK;
            case 'STALKING':
            case 'STRIKING':
            default: return AnimalLogicPhase.ATTACKING;
        }
    }

    shouldEngage(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0)
            return false;
        if (!AnimalBehaviorUtils.isInFrontOfBoat(context.originPos, context.targetBody))
            return false;

        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        return AnimalBehaviorUtils.distanceToBoat(context.originPos, context.targetBody) < params.startAttackDistance;
    }

    shouldDisengage(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0)
            return true;

        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);

        const boatSpeed = context.targetBody.getLinearVelocity().length();
        if (!AnimalBehaviorUtils.isInFrontOfBoat(context.originPos, context.targetBody) &&
            boatSpeed > 0.5 * params.attackSpeed)
            return true;

        return AnimalBehaviorUtils.distanceToBoat(context.originPos, context.targetBody) > params.endAttackDistance;
    }
}
