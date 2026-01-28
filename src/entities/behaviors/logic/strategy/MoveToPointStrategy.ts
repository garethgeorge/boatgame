import * as planck from 'planck';
import { AnimalPathStrategy, AnimalStrategyContext, AnimalSteering } from './AnimalPathStrategy';

/**
 * MOVE TO POINT (Generic)
 * Moves directly to a specific target point.
 */
export class MoveToPointStrategy extends AnimalPathStrategy {
    readonly name = 'Moving to Point';

    constructor(
        private target: planck.Vec2,
        private speed: number,
        private turningSpeed?: number,
        private turningSmoothing?: number
    ) {
        super();
    }

    update(context: AnimalStrategyContext): AnimalSteering {
        return {
            target: this.target,
            speed: this.speed,
            turningSpeed: this.turningSpeed,
            turningSmoothing: this.turningSmoothing
        };
    }
}
