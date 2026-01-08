import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult } from './AnimalLogic';
import { AnimalPathStrategy, CircleFlankStrategy, SternInterceptStrategy, VulnerableChargeStrategy } from './AnimalPathStrategies';

/**
 * "Wolf" attack logic: Flank the boat from the side before striking the stern.
 */
export class WolfAttackLogic implements AnimalLogic {
    readonly name = 'wolf';
    private currentStrategy: AnimalPathStrategy;
    private strategyTimer: number = 0;
    private state: 'PREPARING' | 'ATTACKING' = 'PREPARING';

    constructor() {
        this.currentStrategy = new CircleFlankStrategy();
    }

    isPreparing(): boolean {
        return this.state === 'PREPARING';
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return false;

        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);

        // Don't attack if boat has already passed us
        const localPos = context.targetBody.getLocalPoint(context.originPos);
        if (localPos.y > Boat.STERN_Y) return false;

        const distToBoat = planck.Vec2.distance(context.originPos, context.targetBody.getPosition());
        return distToBoat < params.startAttackDistance;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return true;

        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const distToBoat = planck.Vec2.distance(context.originPos, context.targetBody.getPosition());

        if (distToBoat > params.endAttackDistance) return true;

        return this.currentStrategy.shouldAbort(context.originPos, context.snoutPos, context.targetBody, context.aggressiveness, context.bottles);
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
                this.state = 'ATTACKING';
            }
            return;
        }

        this.strategyTimer -= context.dt;

        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        const longitudinalDist = localPos.y;

        const relVelWorld = context.physicsBody.getLinearVelocity().clone().sub(context.targetBody.getLinearVelocity());
        const relVelLocal = context.targetBody.getLocalVector(relVelWorld);
        const relVelLong = relVelLocal.y;

        const leadTime = 0.25;
        const baseThreshold = Boat.BOW_Y;
        const dynamicThreshold = baseThreshold - relVelLong * leadTime;

        if (longitudinalDist > dynamicThreshold) {
            if (this.currentStrategy.name !== 'SternIntercept') {
                const interceptFactor = 0.2 + (context.aggressiveness * 0.8);
                this.currentStrategy = new SternInterceptStrategy(interceptFactor);
                this.strategyTimer = 2.0;
            }
        } else if (this.strategyTimer < 0) {
            if (Math.random() < 0.67) {
                this.currentStrategy = new CircleFlankStrategy();
            } else {
                this.currentStrategy = new VulnerableChargeStrategy();
            }
            this.strategyTimer = 1.5 + Math.random() * 2.0;
        }
    }

    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult {
        const result = this.currentStrategy.calculatePath(context.originPos, context.snoutPos, context.targetBody, context.aggressiveness, context.bottles);
        return {
            ...result,
            animationState: this.isPreparing() ? 'PREPARING' : 'ATTACKING'
        };
    }
}
