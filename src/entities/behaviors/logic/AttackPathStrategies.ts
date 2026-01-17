import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalSteering } from './AnimalPathStrategy';

/**
 * STERN INTERCEPT (Water)
 * Heads toward the stern. Finshes on falling behind the boat.
 */
export class SternInterceptStrategy extends AnimalPathStrategy {
    readonly name = 'SternIntercept';
    constructor(private interceptFactor: number = 0.5) { super(); }

    update(context: AnimalStrategyContext): AnimalSteering {
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

        return {
            kind: 'STEERING',
            data: {
                target: targetWorldPos,
                speed: params.attackSpeed,
                turningSpeed: params.turningSpeed,
                turningSmoothing: params.turningSmoothing
            }
        };
    }
}

/**
 * CIRCLE FLANK (Water)
 * Heads to a point on one side of the boat. Finishes if too far behind.
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

    update(context: AnimalStrategyContext): AnimalSteering {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const localPos = context.targetBody.getLocalPoint(context.snoutPos);
        if (localPos.x > 1.0) this.side = 1;
        else if (localPos.x < -1.0) this.side = -1;
        const flankLocal = planck.Vec2(this.side * Boat.WIDTH * this.flankOffsetMultiplier, Boat.STERN_Y * 0.2);

        return {
            kind: 'STEERING',
            data: {
                target: context.targetBody.getWorldPoint(flankLocal),
                speed: params.attackSpeed,
                turningSpeed: params.turningSpeed,
                turningSmoothing: params.turningSmoothing
            }
        };
    }
}

/**
 * VULNERABLE CHARGE (Water)
 * Charges directly toward stern. Finishes if too far behind.
 */
export class VulnerableChargeStrategy extends AnimalPathStrategy {
    readonly name = 'Charging';
    constructor() { super(); }
    update(context: AnimalStrategyContext): AnimalSteering {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        return {
            kind: 'STEERING',
            data: {
                target: context.targetBody.getWorldPoint(planck.Vec2(0, Boat.STERN_Y)),
                speed: params.attackSpeed,
                turningSpeed: params.turningSpeed,
                turningSmoothing: params.turningSmoothing
            }
        };
    }
}

/**
 * SHORE HUGGING (Water/Stalking)
 * Moves toward boat maintaining distance from shore
 */
export class ShoreHuggingStrategy extends AnimalPathStrategy {
    readonly name = 'ShoreHugging';
    constructor() { super(); }
    update(context: AnimalStrategyContext): AnimalSteering {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        const boatPos = context.targetBody.getPosition();
        const riverSystem = RiverSystem.getInstance();

        const targetY = context.originPos.y < boatPos.y ? context.originPos.y + 1.0 : context.originPos.y - 1.0;
        const banks = riverSystem.getBankPositions(targetY);
        const distToLeft = Math.abs(context.originPos.x - banks.left);
        const distToRight = Math.abs(context.originPos.x - banks.right);
        const targetX = distToLeft < distToRight ? banks.left + distToLeft : banks.right - distToRight;

        return {
            kind: 'STEERING',
            data: {
                target: planck.Vec2(targetX, targetY),
                speed: params.attackSpeed * 0.5,
                turningSpeed: params.turningSpeed,
                turningSmoothing: params.turningSmoothing
            }
        };
    }
}

/**
 * LURKING (Water)
 * Turns to face boat. Never finishes.
 */
export class LurkingStrategy extends AnimalPathStrategy {
    readonly name = 'Lurking';
    constructor() { super(); }
    update(context: AnimalStrategyContext): AnimalSteering {
        const params = AnimalBehaviorUtils.evaluateAttackParams(context.aggressiveness, context.bottles, 30);
        return {
            kind: 'STEERING',
            data: {
                target: context.targetBody.getPosition(),
                speed: 0,
                turningSpeed: params.turningSpeed,
                turningSmoothing: params.turningSmoothing
            }
        };
    }
}
