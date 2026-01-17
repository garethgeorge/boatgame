import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult } from './AnimalLogic';
import { AnimalPathStrategy } from './AnimalPathStrategy';
import { ShoreHuggingStrategy, SternInterceptStrategy } from './AttackPathStrategies';

export class AmbushAttackLogic implements AnimalLogic {
    public static readonly NAME = 'ambush';
    readonly name = AmbushAttackLogic.NAME;

    /** Animal is orienting towards the target. */
    public static readonly ANIM_PREPARING = 'PREPARING';
    /** Animal is stalking or waiting in ambush. */
    public static readonly ANIM_IDLE = 'IDLE';
    /** Animal is striking or charging. */
    public static readonly ANIM_ATTACKING = 'ATTACKING';

    private currentStrategy: AnimalPathStrategy;
    private state: 'PREPARING' | 'STALKING' | 'STRIKING' = 'PREPARING';

    constructor() {
        this.currentStrategy = new ShoreHuggingStrategy();
    }

    isPreparing(): boolean { return this.state === 'PREPARING'; }

    shouldActivate(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return false;
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        if (context.targetBody.getLocalPoint(context.originPos).y > Boat.STERN_Y) return false;
        return planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) < params.startAttackDistance;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return true;
        if (this.state === 'STRIKING') {
            const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
            if (planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) > params.endAttackDistance) return true;
            return this.currentStrategy.shouldAbort(context);
        }
        return context.targetBody.getLocalPoint(context.snoutPos).y > Boat.STERN_Y + 15.0;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        // See if it is time to switch to a new strategy
        const relVelLong = context.targetBody.getLocalVector(context.physicsBody.getLinearVelocity().clone().sub(context.targetBody.getLinearVelocity())).y;
        if (this.state === 'STALKING' && context.targetBody.getLocalPoint(context.snoutPos).y > Boat.BOW_Y - relVelLong * 0.25) {
            this.state = 'STRIKING';
            this.currentStrategy = new SternInterceptStrategy(0.4 + (context.aggressiveness * 0.6));
        }

        const result = this.currentStrategy.update(context);

        // Decide if preparatory phase is done
        if (this.state === 'PREPARING') {
            if (result.kind !== 'STEERING') return; // Ambush only uses steering strategies
            const diff = result.data.target.clone().sub(context.originPos);
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            let angleDiff = desiredAngle - context.physicsBody.getAngle();
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            if (Math.abs(angleDiff) < 0.45) this.state = 'STALKING';
        }

        const anim = this.state === 'STRIKING' ? AmbushAttackLogic.ANIM_ATTACKING : (this.state === 'PREPARING' ? AmbushAttackLogic.ANIM_PREPARING : AmbushAttackLogic.ANIM_IDLE);
        return { path: result, locomotionType: 'WATER', animationState: anim };
    }
}
