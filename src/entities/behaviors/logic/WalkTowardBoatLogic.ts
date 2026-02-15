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

    public static readonly RESULT_FINISHED = 'walk_toward_boat_finished';

    constructor(params: WalkTowardBoatParams) {
        this.speed = params.speed;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const steering = {
            target: context.targetBody.getPosition(),
            speed: this.speed,
            locomotionType: 'LAND' as const
        };

        const pos = context.animal.localPos();
        const { zone } = context.animal.getTerrainMap().zone(pos.x, pos.z, 0, 2.0);

        if (zone === 'water') {
            return {
                path: steering,
                result: WalkTowardBoatLogic.RESULT_FINISHED,
                finish: true
            };
        }

        return {
            path: steering
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.WALKING;
    }
}
