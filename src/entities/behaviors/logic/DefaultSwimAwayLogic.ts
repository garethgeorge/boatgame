import * as planck from 'planck';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { FleePathStrategy } from './strategy/FleePathStrategy';

/**
 * Swim away logic runs forever.
 */
export class DefaultSwimAwayLogic implements AnimalLogic {
    readonly name = 'DefaultSwimAway';

    private strategy: FleePathStrategy;
    private state: 'IDLE' | 'FLEEING' = 'IDLE';
    private sleepTime: number = 0;

    constructor() {
        this.strategy = new FleePathStrategy();
    }

    activate(context: AnimalLogicContext): void {
        this.sleepTime = 0;
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        this.sleepTime -= context.dt;

        // See whether to engage/disengage attack, sleep time helps
        // debounce
        if (this.sleepTime < 0) {
            if (this.state == 'IDLE') {
                if (this.shouldEngage(context)) {
                    this.state = 'FLEEING';
                    this.sleepTime = 0.5;
                }
            } else {
                if (this.shouldDisengage(context)) {
                    this.state = 'IDLE';
                    this.sleepTime = 0.5;
                }
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

        const steering = this.strategy.update(context);
        return {
            path: steering,
            locomotionType: 'WATER',
        };
    }

    getPhase(): AnimalLogicPhase {
        return this.state === 'IDLE' ? AnimalLogicPhase.IDLE_WATER : AnimalLogicPhase.SWIMING_AWAY;
    }

    shouldEngage(context: AnimalLogicContext): boolean {
        const inFront = AnimalBehaviorUtils.isInFrontOfBoat(context.snoutPos, context.targetBody);
        if (!inFront)
            return false;

        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        return AnimalBehaviorUtils.distanceToBoat(context.originPos, context.targetBody) < params.startFleeDistance;
    }

    shouldDisengage(context: AnimalLogicContext): boolean {
        const inFront = AnimalBehaviorUtils.isInFrontOfBoat(context.snoutPos, context.targetBody);
        if (!inFront)
            return true;

        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        return AnimalBehaviorUtils.distanceToBoat(context.originPos, context.targetBody) > params.stopFleeDistance;
    }
}
