import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicConfig, AnimalLogicPhase } from './AnimalLogic';
import { EnteringWaterStrategy } from './strategy/EnteringWaterStrategy';

export interface EnteringWaterParams {
    targetWaterHeight: number;
    jump: boolean;
}

/**
 * Entering water runs until animal is in the water. Returns next logic.
 */
export class EnteringWaterLogic implements AnimalLogic {
    public static readonly NAME = 'enteringwater';
    public static readonly RESULT_FINISHED = 'entering_water_finished';
    readonly name = EnteringWaterLogic.NAME;

    private strategy: EnteringWaterStrategy;
    private duration: number = 0;

    constructor(params: EnteringWaterParams) {
        this.strategy = new EnteringWaterStrategy(params.jump, params.targetWaterHeight);
    }

    activate(context: AnimalLogicContext) {
        const totalDistance = this.strategy.initialize(context.originPos, context.physicsBody.getAngle());

        const moveSpeed = 8.0 * (1 + 3 * context.aggressiveness);
        this.duration = totalDistance / moveSpeed;
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const steering = this.strategy.update(context);

        // Check if fully in water
        const pos = context.originPos;
        const progress = this.strategy.getEntryProgress(pos);

        const banks = RiverSystem.getInstance().getBankPositions(pos.y);
        const margin = 2.0;
        const distFromLeft = pos.x - banks.left;
        const distFromRight = banks.right - pos.x;
        const distIntoWater = Math.min(distFromLeft, distFromRight);

        // Move to next logic once in water
        if (distIntoWater >= margin || progress >= 1.0) {
            return {
                path: steering,
                locomotionType: 'WATER',
                result: EnteringWaterLogic.RESULT_FINISHED,
                finish: true
            };
        } else {
            return {
                path: steering,
                locomotionType: 'LAND'
            };
        }
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.ENTERING_WATER
    }

    getDuration(): number | undefined {
        return this.duration;
    }

}
