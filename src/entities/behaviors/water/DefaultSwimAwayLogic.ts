import * as planck from 'planck';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult } from './AnimalLogic';
import { FleePathStrategy } from './AnimalPathStrategies';

export class DefaultSwimAwayLogic implements AnimalLogic {
    readonly name = 'swimaway';
    private strategy: FleePathStrategy;

    constructor() {
        this.strategy = new FleePathStrategy();
    }

    isPreparing(): boolean {
        return false;
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        const distToBoat = planck.Vec2.distance(context.originPos, context.targetBody.getPosition());
        return distToBoat < params.startFleeDistance;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        return this.strategy.shouldAbort(context.originPos, context.snoutPos, context.targetBody, context.aggressiveness, context.bottles);
    }

    update(context: AnimalLogicContext): void {
        this.strategy.updateAngle(context.dt, context.targetBody);
    }

    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult {
        const result = this.strategy.calculatePath(context.originPos, context.snoutPos, context.targetBody, context.aggressiveness, context.bottles);
        return {
            ...result,
            animationState: 'FLEEING'
        };
    }
}
