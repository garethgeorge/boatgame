import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase, LocomotionType } from './AnimalLogic';
import { AnimalLogicConfig } from './AnimalLogicConfigs';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';

export interface WaitForBoatParams {
    phase: AnimalLogicPhase;
    waitOnShore?: boolean;
    ignoreBottles?: boolean;
    forwardMin?: number;
    forwardMax?: number;
    backwardMin?: number;
    backwardMax?: number;
}

/**
 * Wait for boat runs until boat is noticed:
 * - Original logic: Animal is in front of boat AND closer than noticeDistance.
 * - Generalized logic: Any of the specified distance criteria are met (forward/backward min/max).
 */
export class WaitForBoatLogic implements AnimalLogic {
    public static readonly RESULT_NOTICED = 'wait_for_boat_noticed';
    readonly name = 'WaitForBoat';

    private locomotionType: LocomotionType;
    private logicPhase: AnimalLogicPhase;
    private ignoreBottles: boolean;

    private forwardMin?: number;
    private forwardMax?: number;
    private backwardMin?: number;
    private backwardMax?: number;

    constructor(params: WaitForBoatParams) {
        const waitOnShore = params.waitOnShore ?? true;
        this.locomotionType = waitOnShore ? 'LAND' : 'WATER';
        this.logicPhase = params.phase;
        this.ignoreBottles = params.ignoreBottles ?? false;

        this.forwardMin = params.forwardMin;
        this.forwardMax = params.forwardMax;
        this.backwardMin = params.backwardMin;
        this.backwardMax = params.backwardMax;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        let result: string | undefined = undefined;


        const distToBoat = AnimalBehaviorUtils.distanceToBoat(context.originPos, context.targetBody);
        const inFront = AnimalBehaviorUtils.isInFrontOfBoat(context.originPos, context.targetBody);

        // Apply bottle-based adjustment to forwardMax if it's the primary notice criterion
        let forwardMax = this.forwardMax;
        if (forwardMax !== undefined) {
            const bottles = this.ignoreBottles ? -1 : context.bottles;
            forwardMax = AnimalBehaviorUtils.evaluateNoticeBoatDistance(
                context.aggressiveness,
                bottles,
                forwardMax
            );
        }

        if (inFront) {
            if ((this.forwardMin !== undefined && distToBoat > this.forwardMin) ||
                (forwardMax !== undefined && distToBoat < forwardMax)) {
                result = WaitForBoatLogic.RESULT_NOTICED;
            }
        } else {
            if ((this.backwardMin !== undefined && distToBoat > this.backwardMin) ||
                (this.backwardMax !== undefined && distToBoat < this.backwardMax)) {
                result = WaitForBoatLogic.RESULT_NOTICED;
            }
        }

        return {
            path: {
                target: context.originPos,
                speed: 0
            },
            locomotionType: this.locomotionType,
            result: result,
            finish: true // Always finish on same frame when result is set
        };
    }

    getPhase(): AnimalLogicPhase {
        return this.logicPhase;
    }
}
