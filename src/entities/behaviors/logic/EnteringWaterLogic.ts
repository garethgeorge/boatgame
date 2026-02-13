import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalLogicConfig } from './AnimalLogicConfigs';
import { EnteringWaterStrategy } from './strategy/EnteringWaterStrategy';

export interface EnteringWaterParams {
    targetWaterHeight: number;
    jump: boolean;
}

/**
 * Entering water runs until animal is in the water. Returns next logic.
 */
export class EnteringWaterLogic implements AnimalLogic {
    public static readonly RESULT_FINISHED = 'entering_water_finished';
    readonly name = 'EnteringWater';

    private strategy: EnteringWaterStrategy;
    private duration: number = 0;
    private jump: boolean = false;
    private jumpDistance: number = 0;
    private targetWaterHeight: number = 0;

    private readonly JUMP_HEIGHT = 4.0;

    constructor(params: EnteringWaterParams) {
        this.jump = params.jump;
        this.targetWaterHeight = params.targetWaterHeight;
        this.strategy = new EnteringWaterStrategy();
    }

    activate(context: AnimalLogicContext) {
        this.strategy.initialize(context.originPos, context.physicsBody.getAngle());

        const moveSpeed = 8.0 * (1 + 3 * context.aggressiveness);

        const facingAngle = context.physicsBody.getAngle() - Math.PI / 2;
        const direction = { x: Math.cos(facingAngle), y: Math.sin(facingAngle) };
        const distToWater = RiverSystem.getInstance().getDistanceToWater(context.originPos, direction);

        // Calculate progress t at which the parabolic jump reaches the water level.
        // solve 4 * t * (1-t) * jump height = -h
        // where h = context.currentHeight
        const h = context.currentHeight;
        const jh = this.JUMP_HEIGHT;
        const t = (jh + Math.sqrt(jh * jh + jh * h)) / (2 * jh);

        this.jumpDistance = (distToWater > 0 ? distToWater : 0) / t;
        this.duration = this.jumpDistance / moveSpeed;
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const steering = this.strategy.update(context);

        // Check if sufficiently in water
        const pos = context.originPos;
        const banks = RiverSystem.getInstance().getBankPositions(pos.y);
        const margin = 2.0;
        const distFromLeft = pos.x - banks.left;
        const distFromRight = banks.right - pos.x;
        const distIntoWater = Math.min(distFromLeft, distFromRight);

        // Move to next logic once in water
        if (distIntoWater >= margin) {
            return {
                path: steering,
                result: EnteringWaterLogic.RESULT_FINISHED,
                finish: true
            };
        } else if (this.jump) {
            this.jump = false;
            return {
                path: steering,
                jump: { height: this.JUMP_HEIGHT, distance: this.jumpDistance }
            };
        } else {
            return {
                path: steering
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
