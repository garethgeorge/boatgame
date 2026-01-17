import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicConfig } from './AnimalLogic';
import { EnteringWaterStrategy } from './EnteringWaterStrategy';

export interface EnteringWaterParams {
    targetWaterHeight: number;
    jump: boolean;
    nextLogicConfig: AnimalLogicConfig;
}

export class EnteringWaterLogic implements AnimalLogic {
    public static readonly NAME = 'enteringwater';
    readonly name = EnteringWaterLogic.NAME;

    private strategy: EnteringWaterStrategy;
    private nextLogicConfig: AnimalLogicConfig;
    private duration: number = 0;

    constructor(params: EnteringWaterParams) {
        this.strategy = new EnteringWaterStrategy(params.jump, params.targetWaterHeight);
        this.nextLogicConfig = params.nextLogicConfig;
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        return true;
    }

    activate(context: AnimalLogicContext) {
        const totalDistance = this.strategy.initialize(context.originPos, context.physicsBody.getAngle());

        const moveSpeed = 8.0 * (1 + 3 * context.aggressiveness);
        this.duration = totalDistance / moveSpeed;
    }

    getEstimatedDuration(context: AnimalLogicContext): number | undefined {
        return this.duration;
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
                nextLogicConfig: this.nextLogicConfig,
                isFinished: true
            };
        } else {
            return {
                path: steering,
                locomotionType: 'LAND'
            };
        }
    }
}
