import * as planck from 'planck';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { FleePathStrategy } from './strategy/FleePathStrategy';

export interface SwimAwayParams {
    zRange?: [number, number];
}

/**
 * Swim away logic runs forever.
 */
export class SwimAwayLogic implements AnimalLogic {
    public static readonly RESULT_OUT_OF_RANGE = 'swim_away_out_of_range';

    readonly name = 'SwimAway';

    private zRange: [number, number] | undefined;
    private strategy: FleePathStrategy;
    private state: 'IDLE' | 'FLEEING' = 'IDLE';
    private sleepTime: number = 0;

    constructor(params: SwimAwayParams) {
        this.zRange = params.zRange;
        this.strategy = new FleePathStrategy();
    }

    activate(context: AnimalLogicContext): void {
        this.sleepTime = 0;
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        this.sleepTime -= context.dt;

        // See whether to engage/disengage attack, sleep time helps
        // debounce
        if (this.sleepTime < 0) {
            if (this.state == 'IDLE') {
                if (this.shouldEngage(context)) {
                    this.state = 'FLEEING';
                    this.sleepTime = 0.5;
                }
            } else {
                if (this.shouldDisengage(context)) {
                    this.state = 'IDLE';
                    this.sleepTime = 0.5;
                }
            }
        }

        if (this.state == 'IDLE') {
            const result = this.inRange(context) ? undefined : SwimAwayLogic.RESULT_OUT_OF_RANGE;
            return {
                path: {
                    target: context.originPos,
                    speed: 0,
                    locomotionType: 'WATER'
                },
                result
            }
        }

        const steering = this.strategy.update(context);
        return {
            path: steering,
        };
    }

    getPhase(): AnimalLogicPhase {
        return this.state === 'IDLE' ? AnimalLogicPhase.IDLE_WATER : AnimalLogicPhase.SWIMING_AWAY;
    }

    private inRange(context: AnimalLogicContext): boolean {
        if (this.zRange === undefined) return true;
        return this.zRange[0] < context.originPos.y && context.originPos.y < this.zRange[1];
    }

    shouldEngage(context: AnimalLogicContext): boolean {
        if (!this.inRange(context))
            return false;

        const inFront = AnimalBehaviorUtils.isInFrontOfBoat(context.snoutPos, context.targetBody);
        if (!inFront)
            return false;

        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        return AnimalBehaviorUtils.distanceToBoat(context.originPos, context.targetBody) < params.startFleeDistance;
    }

    shouldDisengage(context: AnimalLogicContext): boolean {
        if (!this.inRange(context))
            return true;

        const inFront = AnimalBehaviorUtils.isInFrontOfBoat(context.snoutPos, context.targetBody);
        if (!inFront)
            return true;

        const params = AnimalBehaviorUtils.evaluateSwimAwayParams(context.aggressiveness, context.bottles);
        return AnimalBehaviorUtils.distanceToBoat(context.originPos, context.targetBody) > params.stopFleeDistance;
    }
}
