import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase, LocomotionType } from './AnimalLogic';
import { AnimalLogicConfig } from './AnimalLogicConfigs';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';

export interface WaitForBoatParams {
    waitOnShore?: boolean;
    noticeDistance?: number;
    ignoreBottles?: boolean;
    maxDuration?: number;
}

/**
 * Wait for boat runs until boat is noticed:
 * - Animal is in front of boat
 * - Animal is closer than minimum notice distance which may depend on number of
 *   bottles collected
 */
export class WaitForBoatLogic implements AnimalLogic {
    public static readonly RESULT_NOTICED = 'wait_for_boat_noticed';
    readonly name = 'WaitForBoat';

    private locomotionType: LocomotionType;
    private logicPhase: AnimalLogicPhase;
    private noticeDistance: number;
    private ignoreBottles: boolean;

    constructor(params?: WaitForBoatParams) {
        const waitOnShore = params?.waitOnShore ?? true;
        this.locomotionType = waitOnShore ? 'LAND' : 'WATER';
        this.logicPhase = waitOnShore ? AnimalLogicPhase.IDLE_SHORE : AnimalLogicPhase.IDLE_WATER;
        this.noticeDistance = params?.noticeDistance ?? 50.0;
        this.ignoreBottles = params?.ignoreBottles ?? false;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const bottles = this.ignoreBottles ? -1 : context.bottles;
        const noticeBoatDistance = AnimalBehaviorUtils.evaluateNoticeBoatDistance(
            context.aggressiveness,
            bottles,
            this.noticeDistance
        );

        let result: string | undefined = undefined;

        // if boat in range AND not behind the boat, switch to boat noticed logic
        if (noticeBoatDistance > 0) {
            const localPos = context.targetBody.getLocalPoint(context.originPos);
            if (localPos.y < 0) { // Check that animal is in front of the boat center
                const dist = localPos.length(); // Use local distance for efficiency
                if (dist < noticeBoatDistance) {
                    result = WaitForBoatLogic.RESULT_NOTICED;
                }
            }
        }

        return {
            path: {
                target: context.originPos,
                speed: 0
            },
            locomotionType: this.locomotionType,
            result: result
        };
    }

    getPhase(): AnimalLogicPhase {
        return this.logicPhase;
    }
}
