import * as planck from 'planck';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult } from './AnimalLogic';
import { FleePathStrategy } from './AnimalPathStrategies';

export class DefaultSwimAwayLogic implements AnimalLogic {
    readonly name = 'swimaway';

    /** Animal is swimming away. */
    public static readonly ANIM_FLEEING = 'FLEEING';

    private strategy: FleePathStrategy;

    constructor() {
        this.strategy = new FleePathStrategy();
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        return planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) < params.startFleeDistance;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        return this.strategy.shouldAbort(context);
    }

    update(context: AnimalLogicContext): void {
        this.strategy.update(context);
    }

    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult {
        const result = this.strategy.calculatePath(context);
        return { ...result, animationState: DefaultSwimAwayLogic.ANIM_FLEEING };
    }
}
