import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase, LocomotionType } from './AnimalLogic';

export interface DelayParams {
    phase: AnimalLogicPhase,
    waitOnShore?: boolean;
    maxDuration?: number;
}

/**
 * Delay just delays for a period of time.
 * a) boat is noticed and returns next logic
 * b) duration expires (returns TIMEOUT)
 */
export class DelayLogic implements AnimalLogic {
    public static readonly RESULT_FINISHED = 'delay_finished';
    readonly name = 'Delay';

    private locomotionType: LocomotionType;
    private logicPhase: AnimalLogicPhase;
    private timeRemaining: number;

    constructor(params?: DelayParams) {
        this.logicPhase = params.phase;
        const waitOnShore = params?.waitOnShore ?? true;
        this.locomotionType = waitOnShore ? 'LAND' : 'WATER';
        this.timeRemaining = params?.maxDuration ?? 1.0;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        this.timeRemaining -= context.dt;

        return {
            path: {
                target: context.originPos,
                speed: 0
            },
            locomotionType: this.locomotionType,
            result: this.timeRemaining <= 0 ? DelayLogic.RESULT_FINISHED : undefined
        };
    }

    getPhase(): AnimalLogicPhase {
        return this.logicPhase;
    }
}
