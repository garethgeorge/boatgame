import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicConfig, AnimalLogicPhase } from './AnimalLogic';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';

export interface ShoreIdleParams {
    minNoticeDistance?: number;
    ignoreBottles?: boolean;
    nextLogicConfig?: AnimalLogicConfig | (() => AnimalLogicConfig);
    maybeSwitchBehavior?: () => AnimalLogicConfig | null;
}

/**
 * Shore idle runs until:
 * a) boat is noticed and returns next logic
 * b) switch behavior function returns a new logic
 */
export class ShoreIdleLogic implements AnimalLogic {
    public static readonly NAME = 'shoreidle';
    readonly name = ShoreIdleLogic.NAME;

    private minNoticeDistance: number;
    private ignoreBottles: boolean;
    private nextLogicConfig?: AnimalLogicConfig | (() => AnimalLogicConfig);
    private maybeSwitchBehavior?: () => AnimalLogicConfig | null;

    constructor(params: ShoreIdleParams) {
        this.minNoticeDistance = params.minNoticeDistance ?? 50.0;
        this.ignoreBottles = params.ignoreBottles ?? false;
        this.nextLogicConfig = params.nextLogicConfig;
        this.maybeSwitchBehavior = params.maybeSwitchBehavior;
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

        let nextLogicConfig: AnimalLogicConfig | undefined = undefined;

        // if boat in range switch to boat noticed logic
        if (noticeBoatDistance > 0) {
            const dist = planck.Vec2.distance(context.originPos, context.targetBody.getPosition());
            if (dist < noticeBoatDistance) {
                if (typeof this.nextLogicConfig === 'function') {
                    nextLogicConfig = this.nextLogicConfig();
                } else {
                    nextLogicConfig = this.nextLogicConfig;
                }
            }
        }

        // if boat not noticed periodically switch to some other logic
        if (!nextLogicConfig) {
            const probability = context.dt / 5.0;
            if (Math.random() < probability) {
                const config = this.maybeSwitchBehavior?.();
                if (config) {
                    nextLogicConfig = config;
                }
            }
        }

        return {
            path: {
                target: context.originPos,
                speed: 0
            },
            locomotionType: 'LAND',
            nextLogicConfig: nextLogicConfig,
            isFinished: !!nextLogicConfig
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.IDLE_SHORE
    }
}
