import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult } from './AnimalLogic';
import { AnimalPathStrategy, ShoreHuggingStrategy, SternInterceptStrategy } from './AnimalPathStrategies';

type AmbushState = 'PREPARING' | 'STALKING' | 'STRIKING';

/**
 * "Ambush" attack logic: 
 * 1. Move toward the boat hugging the shore (STALKING).
 * 2. Strike the stern when the boat is close enough (STRIKING).
 */
export class AmbushAttackLogic implements AnimalLogic {
    readonly name = 'ambush';
    private currentStrategy: AnimalPathStrategy;
    private state: AmbushState = 'PREPARING';

    constructor() {
        this.currentStrategy = new ShoreHuggingStrategy();
    }

    isPreparing(): boolean {
        return this.state === 'PREPARING';
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return false;

        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);

        // Match original Ambush behavior: can start from further away if stalking
        const localPos = context.targetBody.getLocalPoint(context.originPos);
        if (localPos.y > Boat.STERN_Y) return false;

        const distToBoat = planck.Vec2.distance(context.originPos, context.targetBody.getPosition());
        return distToBoat < params.startAttackDistance;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return true;

        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const distToBoat = planck.Vec2.distance(context.originPos, context.targetBody.getPosition());

        // Handle abort conditions based on state
        if (this.state === 'STRIKING') {
            if (distToBoat > params.endAttackDistance) return true;
            return this.currentStrategy.shouldAbort(context.originPos, context.snoutPos, context.targetBody, context.aggressiveness, context.bottles);
        }

        // In stalking, abort if we are way behind the boat
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        return localPos.y > Boat.STERN_Y + 15.0;
    }

    update(context: AnimalLogicContext) {
        if (this.state === 'PREPARING') {
            const result = this.currentStrategy.calculatePath(context.originPos, context.snoutPos, context.targetBody, context.aggressiveness, context.bottles);
            const diff = result.targetWorldPos.clone().sub(context.originPos);
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;

            let angleDiff = desiredAngle - context.physicsBody.getAngle();
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

            if (Math.abs(angleDiff) < 0.45) {
                this.state = 'STALKING';
            }
            return;
        }

        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        const longitudinalDist = localPos.y;

        const relVelWorld = context.physicsBody.getLinearVelocity().clone().sub(context.targetBody.getLinearVelocity());
        const relVelLocal = context.targetBody.getLocalVector(relVelWorld);
        const relVelLong = relVelLocal.y;

        const leadTime = 0.25;
        const baseThreshold = Boat.BOW_Y;
        const dynamicThreshold = baseThreshold - relVelLong * leadTime;

        switch (this.state) {
            case 'STALKING':
                if (longitudinalDist > dynamicThreshold) {
                    this.state = 'STRIKING';
                    const interceptFactor = 0.4 + (context.aggressiveness * 0.6);
                    this.currentStrategy = new SternInterceptStrategy(interceptFactor);
                }
                break;

            case 'STRIKING':
                break;
        }
    }

    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult {
        const result = this.currentStrategy.calculatePath(context.originPos, context.snoutPos, context.targetBody, context.aggressiveness, context.bottles);
        return {
            ...result,
            animationState: this.state === 'STRIKING' ? 'ATTACKING' : (this.state === 'PREPARING' ? 'PREPARING' : 'IDLE')
        };
    }
}
