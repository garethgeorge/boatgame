import * as planck from 'planck';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalPathResult } from './AnimalPathStrategy';

/**
 * ENTERING WATER (Land/Transition)
 */
export class EnteringWaterStrategy extends AnimalPathStrategy {
    readonly name = 'EnteringWater';
    private entryStartPosition: planck.Vec2 | null = null;
    private totalEntryDistance: number = 0;
    private facingAngle: number | null = null;

    calculatePath(context: AnimalStrategyContext): AnimalPathResult {
        const riverSystem = RiverSystem.getInstance();
        if (!riverSystem) {
            return { targetWorldPos: context.originPos.clone(), desiredSpeed: 0 };
        }

        if (this.entryStartPosition === null) {
            this.initialize(context.originPos, context.physicsBody.getAngle());
        }

        const moveSpeed = 8.0 * (1 + 3 * context.aggressiveness);
        const targetWorldPos = this.getTargetPos();

        return {
            targetWorldPos,
            desiredSpeed: moveSpeed
        };
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
