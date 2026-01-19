import * as planck from 'planck';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase, AnimalLogicResultState } from './AnimalLogic';
import { FleePathStrategy } from './FleePathStrategy';

/**
 * Swim away logic runs forever.
 */
export class DefaultSwimAwayLogic implements AnimalLogic {
    public static readonly NAME = 'swimaway';
    readonly name = DefaultSwimAwayLogic.NAME;

    private strategy: FleePathStrategy;
    private state: 'IDLE' | 'FLEEING' = 'IDLE';

    constructor() {
        this.strategy = new FleePathStrategy();
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        // See whether to engage/disengage attack
        if (this.state == 'IDLE') {
            if (this.shouldEngage(context)) {
                this.state = 'FLEEING';
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
                resultState: AnimalLogicResultState.CONTINUE
            }
        }

        const steering = this.strategy.update(context);
        return {
            path: steering,
            locomotionType: 'WATER',
            resultState: AnimalLogicResultState.CONTINUE
        };
    }

    getPhase(): AnimalLogicPhase {
        return this.state === 'IDLE' ? AnimalLogicPhase.IDLE_WATER : AnimalLogicPhase.SWIMING_AWAY;
    }

    shouldEngage(context: AnimalLogicContext): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        return planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) < params.startFleeDistance;
    }

    shouldDisengage(context: AnimalLogicContext): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        const boatToAnimal = context.originPos.clone().sub(context.targetBody.getPosition());
        const isMovingTowards = planck.Vec2.dot(context.targetBody.getLinearVelocity(), boatToAnimal) > 0;
        return boatToAnimal.length() > params.stopFleeDistance ||
            (context.targetBody.getLinearVelocity().length() > 0.5 && !isMovingTowards);
    }
}
