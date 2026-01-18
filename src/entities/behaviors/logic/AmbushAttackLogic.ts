import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './AnimalPathStrategy';
import { ShoreHuggingStrategy, SternInterceptStrategy } from './AttackPathStrategies';

export class AmbushAttackLogic implements AnimalLogic {
    public static readonly NAME = 'ambush';
    readonly name = AmbushAttackLogic.NAME;

    private currentStrategy: AnimalPathStrategy;
    private state: 'PREPARING' | 'STALKING' | 'STRIKING' = 'PREPARING';

    constructor() {
        this.currentStrategy = new ShoreHuggingStrategy();
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return false;
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        if (context.targetBody.getLocalPoint(context.originPos).y > Boat.STERN_Y) return false;
        return planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) < params.startAttackDistance;
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

        const steering = this.currentStrategy.update(context);

        // Decide if preparatory phase is done
        if (this.state === 'PREPARING') {
            const diff = steering.target.clone().sub(context.originPos);
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            let angleDiff = desiredAngle - context.physicsBody.getAngle();
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            if (Math.abs(angleDiff) < 0.45) this.state = 'STALKING';
        }

        const phase = this.state === 'STRIKING' ? AnimalLogicPhase.ATTACKING : (this.state === 'PREPARING' ? AnimalLogicPhase.PREPARING : AnimalLogicPhase.IDLE);
        return {
            path: steering,
            locomotionType: 'WATER',
            logicPhase: phase,
            isFinished: this.shouldDisengage(context)
        };
    }

    shouldDisengage(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return true;
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);

        if (planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) > params.endAttackDistance) return true;

        const boatSpeed = context.targetBody.getLinearVelocity().length();
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        return localPos.y > Boat.STERN_Y && boatSpeed > 0.5 * params.attackSpeed;
    }
}
