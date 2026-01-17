import * as planck from 'planck';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult } from './AnimalLogic';
import { FleePathStrategy } from './FleePathStrategy';

export class DefaultSwimAwayLogic implements AnimalLogic {
    public static readonly NAME = 'swimaway';
    readonly name = DefaultSwimAwayLogic.NAME;

    /** Animal is swimming away. */
    public static readonly ANIM_FLEEING = 'FLEEING';

    private strategy: FleePathStrategy;

    constructor() {
        this.strategy = new FleePathStrategy();
    }

    /**
     * Start when boat is within distance
     */
    shouldActivate(context: AnimalLogicContext): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        return planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) < params.startFleeDistance;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const steering = this.strategy.update(context);
        return {
            path: steering,
            locomotionType: 'WATER',
            animationState: DefaultSwimAwayLogic.ANIM_FLEEING,
            isFinished: this.shouldDisengage(context)
        };
    }

    shouldDisengage(context: AnimalLogicContext): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        const boatToAnimal = context.originPos.clone().sub(context.targetBody.getPosition());
        const isMovingTowards = planck.Vec2.dot(context.targetBody.getLinearVelocity(), boatToAnimal) > 0;
        return boatToAnimal.length() > params.stopFleeDistance ||
            (context.targetBody.getLinearVelocity().length() > 0.5 && !isMovingTowards);
    }
}
