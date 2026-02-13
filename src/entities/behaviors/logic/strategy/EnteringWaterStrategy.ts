import * as planck from 'planck';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalSteering } from './AnimalPathStrategy';

/**
 * ENTERING WATER (Land/Transition)
 */
export class EnteringWaterStrategy extends AnimalPathStrategy {
    readonly name = 'EnteringWater';

    // Configuration
    private targetPos: planck.Vec2;

    /**
     * Specialized initialization for entering water.
     */
    initialize(originPos: planck.Vec2, angle: number) {
        const startPos = originPos.clone();
        const facingAngle = angle - Math.PI / 2;
        const direction = planck.Vec2(Math.cos(facingAngle), Math.sin(facingAngle));

        // a point far enough away
        this.targetPos = startPos.clone().add(direction.mul(50));
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        const moveSpeed = 8.0 * (1 + 3 * context.aggressiveness);
        const targetWorldPos = this.targetPos;

        return {
            target: targetWorldPos,
            speed: moveSpeed,
            locomotionType: 'LAND'
        };
    }
}
