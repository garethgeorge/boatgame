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
    private targetWaterHeight: number;
    private jump: boolean;
    private nextLogicConfig: AnimalLogicConfig;
    private duration: number = 0;
    private initialized: boolean = false;

    constructor(params: EnteringWaterParams) {
        this.strategy = new EnteringWaterStrategy();
        this.targetWaterHeight = params.targetWaterHeight;
        this.jump = params.jump;
        this.nextLogicConfig = params.nextLogicConfig;
    }

    private ensureInitialized(context: AnimalLogicContext) {
        if (this.initialized) return;

        const totalDistance = this.strategy.initialize(context.originPos, context.physicsBody.getAngle());

        const moveSpeed = 8.0 * (1 + 3 * context.aggressiveness);
        this.duration = totalDistance / moveSpeed;

        this.initialized = true;
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        return true; // Usually activated via chaining or manual setup
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        return false;
    }

    update(context: AnimalLogicContext) {
        this.ensureInitialized(context);
        this.strategy.update(context);
    }

    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult {
        this.ensureInitialized(context);

        const result = this.strategy.calculatePath(context);
        const pos = context.originPos;
        const progress = this.strategy.getEntryProgress(pos);

        // Check if fully in water
        const banks = RiverSystem.getInstance().getBankPositions(pos.y);
        const margin = 2.0;
        const distFromLeft = pos.x - banks.left;
        const distFromRight = banks.right - pos.x;
        const distIntoWater = Math.min(distFromLeft, distFromRight);

        if (distIntoWater >= margin || progress >= 1.0) {
            // Transition complete
            return {
                ...result,
                locomotionType: 'WATER',
                nextLogicConfig: this.nextLogicConfig,
                isFinished: true
            };
        }

        // Determine locomotion type and positioning (Land/Transition)
        const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(pos.x, pos.y);
        const terrainNormal = RiverSystem.getInstance().terrainGeometry.calculateNormal(pos.x, pos.y);

        let jumpHeight = 0.0;
        if (this.jump) {
            // Apply jump curve
            const t = Math.max(0, Math.min(progress, 1));
            const curve = 4 * t * (1.0 - t);
            jumpHeight = 2.0 * curve;
        }

        let height = terrainHeight;
        let normal = terrainNormal;

        if (distIntoWater > 0) {
            // Transition zone - interpolate height and normal
            const lerpT = Math.min(1.0, distIntoWater / margin);
            const targetNormal = new THREE.Vector3(0, 1, 0);

            height = THREE.MathUtils.lerp(terrainHeight, this.targetWaterHeight, lerpT);
            normal = terrainNormal.clone().lerp(targetNormal, lerpT).normalize();
        }

        return {
            ...result,
            locomotionType: 'LAND',
            explicitHeight: height + jumpHeight,
            explicitNormal: normal
        };
    }

    getEstimatedDuration(context: AnimalLogicContext): number | undefined {
        this.ensureInitialized(context);
        return this.duration;
    }
}
