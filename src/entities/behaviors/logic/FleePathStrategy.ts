import * as planck from 'planck';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalPathResult } from './AnimalPathStrategy';

/**
 * FLEE PATH (Water/Prey)
 */
export class FleePathStrategy extends AnimalPathStrategy {
    readonly name = 'Fleeing';
    private fleeAngle: number = 0;
    private timeSinceLastAngleChange: number = 0;

    constructor() { super(); }

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        const targetWorldPos = context.originPos.clone().add(planck.Vec2(Math.sin(this.fleeAngle), -Math.cos(this.fleeAngle)).mul(10));
        return { targetWorldPos, desiredSpeed: params.fleeSpeed, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }

    override update(context: AnimalStrategyContext) {
        this.timeSinceLastAngleChange += context.dt;
        if (this.timeSinceLastAngleChange > 2.0 || this.fleeAngle === 0) {
            const vel = context.targetBody.getLinearVelocity();
            const boatAngle = vel.length() > 0.5 ? Math.atan2(vel.y, vel.x) + Math.PI / 2 : context.targetBody.getAngle();
            this.fleeAngle = boatAngle + (Math.random() - 0.5) * Math.PI / 6;
            this.timeSinceLastAngleChange = 0;
        }
    }

    override shouldAbort(context: AnimalStrategyContext): boolean {
        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        const boatToAnimal = context.originPos.clone().sub(context.targetBody.getPosition());
        const isMovingTowards = planck.Vec2.dot(context.targetBody.getLinearVelocity(), boatToAnimal) > 0;
        return boatToAnimal.length() > params.stopFleeDistance || (context.targetBody.getLinearVelocity().length() > 0.5 && !isMovingTowards);
    }
}
