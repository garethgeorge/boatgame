import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalPathResult } from './AnimalPathStrategy';

/**
 * STERN INTERCEPT (Water)
 */
export class SternInterceptStrategy extends AnimalPathStrategy {
    readonly name = 'SternIntercept';
    constructor(private interceptFactor: number = 0.5) { super(); }

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const localAttackPos = context.targetBody.getLocalPoint(context.snoutPos);
        const sternLocalY = (Boat.STERN_Y * 0.7 + Boat.FRONT_ZONE_END_Y * 0.3);
        const sternLocalX = localAttackPos.y < Boat.STERN_Y ? (localAttackPos.x < 0.0 ? -Boat.WIDTH * 0.4 : Boat.WIDTH * 0.4) : 0.0;
        const sternWorldPos = context.targetBody.getWorldPoint(planck.Vec2(sternLocalX, sternLocalY));
        const boatVel = context.targetBody.getLinearVelocity();
        const diff = sternWorldPos.clone().sub(context.snoutPos);
        const dist = diff.length();
        const dirToTarget = diff.clone();
        if (dist > 0.01) dirToTarget.normalize();

        const dotProd = planck.Vec2.dot(boatVel, dirToTarget);
        const lateralVel = boatVel.clone().sub(dirToTarget.clone().mul(dotProd));
        const lateralSpeed = lateralVel.length();

        let steeringDir: planck.Vec2 = lateralVel.clone().add(dirToTarget);
        if (lateralSpeed > params.attackSpeed) {
            steeringDir.normalize();
            steeringDir.mul(params.attackSpeed);
        } else {
            const closingSpeed = Math.sqrt(params.attackSpeed ** 2 - lateralSpeed ** 2);
            steeringDir = lateralVel.clone().add(dirToTarget.clone().mul(closingSpeed));
        }

        const targetWorldPos = planck.Vec2(
            sternWorldPos.x + (context.snoutPos.x + steeringDir.x - sternWorldPos.x) * this.interceptFactor,
            sternWorldPos.y + (context.snoutPos.y + steeringDir.y - sternWorldPos.y) * this.interceptFactor
        );

        return { targetWorldPos, desiredSpeed: params.attackSpeed, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }

    override shouldAbort(context: AnimalStrategyContext): boolean {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const boatSpeed = context.targetBody.getLinearVelocity().length();
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        return localPos.y > Boat.STERN_Y && boatSpeed > 0.5 * params.attackSpeed;
    }
}

/**
 * CIRCLE FLANK (Water)
 */
export class CircleFlankStrategy extends AnimalPathStrategy {
    readonly name = 'Flanking';
    private side: number;
    private flankOffsetMultiplier: number;

    constructor() {
        super();
        this.side = Math.random() > 0.5 ? 1 : -1;
        this.flankOffsetMultiplier = 3.0 + Math.random() * 2.0;
    }

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        if (localPos.x > 1.0) this.side = 1;
        else if (localPos.x < -1.0) this.side = -1;
        const flankLocal = planck.Vec2(this.side * Boat.WIDTH * this.flankOffsetMultiplier, Boat.STERN_Y * 0.2);

        return { targetWorldPos: context.targetBody.getWorldPoint(flankLocal), desiredSpeed: params.attackSpeed, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }

    override shouldAbort(context: AnimalStrategyContext): boolean {
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        return localPos.y > Boat.STERN_Y + 4.0;
    }
}

/**
 * VULNERABLE CHARGE (Water)
 */
export class VulnerableChargeStrategy extends AnimalPathStrategy {
    readonly name = 'Charging';
    constructor() { super(); }
    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        return { targetWorldPos: context.targetBody.getWorldPoint(planck.Vec2(0, Boat.STERN_Y)), desiredSpeed: params.attackSpeed, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }
}

/**
 * SHORE HUGGING (Water/Stalking)
 */
export class ShoreHuggingStrategy extends AnimalPathStrategy {
    readonly name = 'ShoreHugging';
    constructor() { super(); }
    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const boatPos = context.targetBody.getPosition();
        const riverSystem = RiverSystem.getInstance();
        if (!riverSystem) return { targetWorldPos: boatPos.clone(), desiredSpeed: params.attackSpeed };

        const targetY = context.originPos.y < boatPos.y ? context.originPos.y + 1.0 : context.originPos.y - 1.0;
        const banks = riverSystem.getBankPositions(targetY);
        const distToLeft = Math.abs(context.originPos.x - banks.left);
        const distToRight = Math.abs(context.originPos.x - banks.right);
        const targetX = distToLeft < distToRight ? banks.left + distToLeft : banks.right - distToRight;

        return { targetWorldPos: planck.Vec2(targetX, targetY), desiredSpeed: params.attackSpeed * 0.5, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }
}

/**
 * LURKING (Water)
 */
export class LurkingStrategy extends AnimalPathStrategy {
    readonly name = 'Lurking';
    constructor() { super(); }
    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        return { targetWorldPos: context.targetBody.getPosition(), desiredSpeed: 0, turningSpeed: params.turningSpeed, turningSmoothing: params.turningSmoothing };
    }
}
