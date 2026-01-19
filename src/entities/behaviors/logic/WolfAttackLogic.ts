import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './AnimalPathStrategy';
import { CircleFlankStrategy, SternInterceptStrategy, VulnerableChargeStrategy } from './AttackPathStrategies';

/**
 * Wolf attack runs forever.
 */
export class WolfAttackLogic implements AnimalLogic {
    public static readonly NAME = 'wolf';
    readonly name = WolfAttackLogic.NAME;

    private currentStrategy: AnimalPathStrategy;
    private strategyTimer: number = 0;
    private state: 'IDLE' | 'PREPARING' | 'ATTACKING' = 'IDLE';

    constructor() {
        this.currentStrategy = new CircleFlankStrategy();
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {

        // See whether to engage/disengage attack
        if (this.state == 'IDLE') {
            if (this.shouldEngage(context)) {
                this.state = 'PREPARING';
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
            }
        }

        // Check for time to change strategy
        this.strategyTimer -= context.dt;
        const relVelLong = context.targetBody.getLocalVector(context.physicsBody.getLinearVelocity().clone().sub(context.targetBody.getLinearVelocity())).y;
        const dynamicThreshold = Boat.BOW_Y - relVelLong * 0.25;

        // Switch to intercept once we are getting close
        // Otherwise randomly select between flanking and charging
        if (context.targetBody.getLocalPoint(context.snoutPos).y > dynamicThreshold) {
            if (this.currentStrategy.name !== 'SternIntercept') {
                this.currentStrategy = new SternInterceptStrategy(0.2 + (context.aggressiveness * 0.8));
                this.strategyTimer = 2.0;
                this.state = 'ATTACKING';
            }
        } else if (this.strategyTimer < 0) {
            this.currentStrategy = Math.random() < 0.67 ? new CircleFlankStrategy() : new VulnerableChargeStrategy();
            this.strategyTimer = 1.5 + Math.random() * 2.0;
        }

        // Get the current steering
        const steering = this.currentStrategy.update(context);

        // See if the angle to the desired angle is such that the attack is
        // no longer preparing
        if (this.state === 'PREPARING') {
            const diff = steering.target.clone().sub(context.originPos);
            const desiredAngle = Math.atan2(diff.y, diff.x) + Math.PI / 2;
            let angleDiff = desiredAngle - context.physicsBody.getAngle();
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            if (Math.abs(angleDiff) < 0.45) this.state = 'ATTACKING';
        }

        return {
            path: steering,
            locomotionType: 'WATER',
        };
    }

    getPhase(): AnimalLogicPhase {
        switch (this.state) {
            case 'IDLE': return AnimalLogicPhase.IDLE_WATER;
            case 'PREPARING': return AnimalLogicPhase.PREPARING_ATTACK;
            case 'ATTACKING': return AnimalLogicPhase.ATTACKING;
        }
    }

    shouldEngage(context: AnimalLogicContext): boolean {
        if (context.bottles <= 0) return false;
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        if (context.targetBody.getLocalPoint(context.originPos).y > Boat.STERN_Y) return false;
        return planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) < params.startAttackDistance;
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
