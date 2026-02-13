import * as planck from 'planck';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { MoveToPointStrategy } from './strategy/MoveToPointStrategy';

export interface SwimBackInRangeParams {
    zRange: [number, number];
}

/**
 * Logic to swim an animal back into its allowed zRange.
 * Picks a random point inside the range and swims there.
 */
export class SwimBackInRangeLogic implements AnimalLogic {
    public static readonly RESULT_REACHED = 'reached_target';
    public static readonly RESULT_TIMEOUT = 'timeout';

    readonly name = 'SwimBackInRange';

    private zRange: [number, number];
    private target: planck.Vec2 | undefined;
    private strategy: MoveToPointStrategy | undefined;
    private timeElapsed: number = 0;
    private readonly timeout: number = 5.0;

    constructor(params: SwimBackInRangeParams) {
        this.zRange = params.zRange;
    }

    activate(context: AnimalLogicContext): void {
        this.timeElapsed = 0;

        // Pick a random point in the river within the zRange
        const [zMin, zMax] = this.zRange;
        const targetZ = zMin + Math.random() * (zMax - zMin);
        const banks = RiverSystem.getInstance().getBankPositions(targetZ);

        // Stay a bit away from the banks
        const margin = 2.0;
        const minX = Math.min(banks.left + margin, banks.right - margin);
        const maxX = Math.max(banks.left + margin, banks.right - margin);
        const targetX = minX + Math.random() * (maxX - minX);

        this.target = new planck.Vec2(targetX, targetZ);

        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        this.strategy = new MoveToPointStrategy(
            this.target,
            params.fleeSpeed,
            'WATER',
            params.turningSpeed,
            params.turningSmoothing
        );
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        if (!this.strategy || !this.target) {
            return {
                path: { target: context.originPos, speed: 0, locomotionType: 'WATER' },
                result: SwimBackInRangeLogic.RESULT_TIMEOUT
            };
        }

        this.timeElapsed += context.dt;

        // Check if reached
        const distSq = planck.Vec2.distanceSquared(context.originPos, this.target);
        if (distSq < 2.0 * 2.0) {
            return {
                path: { target: context.originPos, speed: 0, locomotionType: 'WATER' },
                result: SwimBackInRangeLogic.RESULT_REACHED
            };
        }

        // Check timeout
        if (this.timeElapsed >= this.timeout) {
            return {
                path: { target: context.originPos, speed: 0, locomotionType: 'WATER' },
                result: SwimBackInRangeLogic.RESULT_TIMEOUT
            };
        }

        const steering = this.strategy.update(context);
        return {
            path: steering,
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.SWIMING_AWAY; // Reusing phase for now as it's active swimming
    }
}
