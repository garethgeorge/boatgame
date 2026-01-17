import * as planck from 'planck';
import * as THREE from 'three';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalSteering } from './AnimalPathStrategy';

/**
 * ENTERING WATER (Land/Transition)
 */
export class EnteringWaterStrategy extends AnimalPathStrategy {
    readonly name = 'EnteringWater';
    private entryStartPosition: planck.Vec2 | null = null;
    private totalEntryDistance: number = 0;
    private facingAngle: number | null = null;

    // Configuration
    private jump: boolean = false;
    private targetWaterHeight: number = 0;

    constructor(jump: boolean, targetWaterHeight: number) {
        super();
        this.jump = jump;
        this.targetWaterHeight = targetWaterHeight;
    }

    /**
     * Specialized initialization for entering water.
     */
    initialize(originPos: planck.Vec2, angle: number): number {
        this.entryStartPosition = originPos.clone();
        this.facingAngle = angle - Math.PI / 2;
        const direction = planck.Vec2(Math.cos(this.facingAngle), Math.sin(this.facingAngle));

        let distanceToWater = RiverSystem.getInstance().getDistanceToWater(originPos, direction);
        if (distanceToWater < 0) return 0;

        const margin = 2.0;
        this.totalEntryDistance = distanceToWater + margin;
        return this.totalEntryDistance;
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const riverSystem = RiverSystem.getInstance();

        const moveSpeed = 8.0 * (1 + 3 * context.aggressiveness);
        const targetWorldPos = this.getTargetPos();

        // Calculate height and normal
        const pos = context.originPos;
        const progress = this.getEntryProgress(pos);

        const banks = riverSystem.getBankPositions(pos.y);
        const margin = 2.0;
        const distFromLeft = pos.x - banks.left;
        const distFromRight = banks.right - pos.x;
        const distIntoWater = Math.min(distFromLeft, distFromRight);

        // Determine locomotion type and positioning (Land/Transition)
        const terrainHeight = riverSystem.terrainGeometry.calculateHeight(pos.x, pos.y);
        const terrainNormal = riverSystem.terrainGeometry.calculateNormal(pos.x, pos.y);

        let jumpHeight = 0.0;
        if (this.jump) {
            // Apply jump curve
            const t = Math.max(0, Math.min(progress, 1));
            const curve = 4 * t * (1.0 - t);
            jumpHeight = 2.0 * curve;
        }

        let explicitHeight = terrainHeight;
        let explicitNormal = terrainNormal; // Default to terrain normal

        if (distIntoWater > 0) {
            // Transition zone - interpolate height and normal
            const lerpT = Math.min(1.0, distIntoWater / margin);
            const targetNormal = new THREE.Vector3(0, 1, 0);

            explicitHeight = THREE.MathUtils.lerp(terrainHeight, this.targetWaterHeight, lerpT);
            explicitNormal = terrainNormal.clone().lerp(targetNormal, lerpT).normalize();
        }

        explicitHeight += jumpHeight;

        return {
            kind: 'STEERING',
            data: {
                target: targetWorldPos,
                speed: moveSpeed,
                height: explicitHeight,
                facing: {
                    normal: explicitNormal
                }
            }
        };
    }

    getEntryProgress(currentPos: planck.Vec2): number {
        if (!this.entryStartPosition || this.totalEntryDistance <= 0) return 0;
        const distTraveled = currentPos.clone().sub(this.entryStartPosition).length();
        return Math.min(1.0, distTraveled / this.totalEntryDistance);
    }

    getTargetPos(): planck.Vec2 {
        if (!this.entryStartPosition || this.facingAngle === null) return planck.Vec2(0, 0);
        const direction = planck.Vec2(Math.cos(this.facingAngle), Math.sin(this.facingAngle));
        return this.entryStartPosition.clone().add(direction.mul(this.totalEntryDistance));
    }
}
