import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult } from './AnimalLogic';
import { AnimalPathStrategy, CircleFlankStrategy, SternInterceptStrategy, VulnerableChargeStrategy } from './AnimalPathStrategies';

export class WolfAttackLogic implements AnimalLogic {
    readonly name = 'wolf';

    /** Animal is orienting towards the target. */
    public static readonly ANIM_PREPARING = 'PREPARING';
    /** Animal is actively pursuing or flanking the target. */
    public static readonly ANIM_ATTACKING = 'ATTACKING';

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
        if (context.targetBody.getLocalPoint(context.originPos).y > Boat.STERN_Y) return false;
        return planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) < params.startAttackDistance;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return true;
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        if (planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) > params.endAttackDistance) return true;
        return this.currentStrategy.shouldAbort(context);
    }

    update(context: AnimalLogicContext) {
        this.currentStrategy.update(context);
        if (this.state === 'PREPARING') {
            const result = this.currentStrategy.calculatePath(context);
            const diff = result.targetWorldPos.clone().sub(context.originPos);
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            let angleDiff = desiredAngle - context.physicsBody.getAngle();
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            if (Math.abs(angleDiff) < 0.45) this.state = 'ATTACKING';
            return;
        }

        this.strategyTimer -= context.dt;
        const relVelLong = context.targetBody.getLocalVector(context.physicsBody.getLinearVelocity().clone().sub(context.targetBody.getLinearVelocity())).y;
        const dynamicThreshold = Boat.BOW_Y - relVelLong * 0.25;

        if (context.targetBody.getLocalPoint(context.snoutPos).y > dynamicThreshold) {
            if (this.currentStrategy.name !== 'SternIntercept') {
                this.currentStrategy = new SternInterceptStrategy(0.2 + (context.aggressiveness * 0.8));
                this.strategyTimer = 2.0;
            }
        } else if (this.strategyTimer < 0) {
            this.currentStrategy = Math.random() < 0.67 ? new CircleFlankStrategy() : new VulnerableChargeStrategy();
            this.strategyTimer = 1.5 + Math.random() * 2.0;
        }
    }

    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult {
        const result = this.currentStrategy.calculatePath(context);
        return {
            ...result,
            animationState: this.isPreparing() ? WolfAttackLogic.ANIM_PREPARING : WolfAttackLogic.ANIM_ATTACKING
        };
    }
}
