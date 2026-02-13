import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';

export interface WalkTowardBoatParams {
    speed: number;
}

/**
 * Logic that makes the animal walk directly toward the boat.
 */
export class WalkTowardBoatLogic implements AnimalLogic {
    readonly name = 'WalkTowardBoat';
    private speed: number;

    constructor(params: WalkTowardBoatParams) {
        this.speed = params.speed;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        return {
            path: {
                target: context.targetBody.getPosition(),
                speed: this.speed,
                locomotionType: 'LAND'
            }
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.WALKING;
    }
}
