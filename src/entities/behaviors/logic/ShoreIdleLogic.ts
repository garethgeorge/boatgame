import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicConfig, AnimalLogicPhase } from './AnimalLogic';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';

export interface ShoreIdleParams {
    minNoticeDistance?: number;
    ignoreBottles?: boolean;
    maxDuration?: number;
}

/**
 * Shore idle runs until:
 * a) boat is noticed and returns next logic
 * b) duration expires (returns TIMEOUT)
 */
export class ShoreIdleLogic implements AnimalLogic {
    public static readonly NAME = 'shoreidle';
    readonly name = ShoreIdleLogic.NAME;

    private minNoticeDistance: number;
    private ignoreBottles: boolean;

    constructor(params?: ShoreIdleParams) {
        this.minNoticeDistance = params?.minNoticeDistance ?? 50.0;
        this.ignoreBottles = params?.ignoreBottles ?? false;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const bottles = this.ignoreBottles ? -1 : context.bottles;
        const noticeBoatDistance = AnimalBehaviorUtils.evaluateNoticeBoatDistance(
            context.aggressiveness,
            bottles,
            this.minNoticeDistance
        );

        let result: string | undefined = undefined;

        // if boat in range switch to boat noticed logic
        if (noticeBoatDistance > 0) {
            const dist = planck.Vec2.distance(context.originPos, context.targetBody.getPosition());
            if (dist < noticeBoatDistance) {
                result = 'DONE';
            }
        }

        return {
            path: {
                target: context.originPos,
                speed: 0
            },
            locomotionType: 'LAND',
            result: result
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.IDLE_SHORE
    }
}
