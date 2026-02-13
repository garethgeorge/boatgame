import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { ShoreWalkStrategy, ShoreTurnStrategy } from './strategy/ShoreWalkStrategy';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';

export interface ShoreWalkParams {
    walkDistance: number;
    speed: number; // Walk speed
    finishWithinDistanceOfBoat?: number;
}

type ShoreWalkState = 'START' | 'OUTBOUND' | 'TURN' | 'INBOUND' | 'END' | 'FINISHED';

/**
 * Shore walk runs until walk completed then returns the next logic
 */
export class ShoreWalkLogic implements AnimalLogic {
    public static readonly RESULT_FINISHED = 'shore_walk_finished';

    readonly name = 'ShoreWalk';

    private strategy: AnimalPathStrategy | null = null;
    private walkDistance: number;
    private speed: number;
    private finishWithinDistanceOfBoat?: number;

    private state: ShoreWalkState = 'START';

    constructor(params: ShoreWalkParams) {
        this.walkDistance = params.walkDistance;
        this.speed = params.speed;
        this.finishWithinDistanceOfBoat = params.finishWithinDistanceOfBoat;
    }

    activate(context: AnimalLogicContext) {
        this.state = 'START';
        this.strategy = null;
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const currentPos = context.originPos;
        const ROTATION_SPEED = 2.0;

        // Check if we should finish early based on boat distance
        if (this.finishWithinDistanceOfBoat !== undefined &&
            this.state !== 'END' && this.state !== 'FINISHED') {
            const dist = AnimalBehaviorUtils.distanceToBoat(currentPos, context.targetBody);
            if (dist < this.finishWithinDistanceOfBoat) {
                // Skip to end to turn to shore
                this.state = 'END';
                this.strategy = null;
            }
        }

        // Set strategy if last one finished
        if (!this.strategy) {
            switch (this.state) {
                case 'START':
                    // Create strategy to turn to face upstream (Direction 1)
                    this.strategy = new ShoreTurnStrategy(
                        currentPos,
                        1,
                        ROTATION_SPEED,
                        () => {
                            this.state = 'OUTBOUND';
                            this.strategy = null;
                        }
                    );
                    break;
                case 'OUTBOUND':
                    // Create strategy to walk upstream
                    this.strategy = new ShoreWalkStrategy(
                        currentPos,
                        'upstream',
                        this.walkDistance,
                        this.speed,
                        () => {
                            this.state = 'TURN';
                            this.strategy = null;
                        }
                    );
                    break;
                case 'TURN':
                    // Create strategy to turn to face downstream (Direction 3)
                    this.strategy = new ShoreTurnStrategy(
                        currentPos,
                        3,
                        ROTATION_SPEED,
                        () => {
                            this.state = 'INBOUND';
                            this.strategy = null;
                        }
                    );
                    break;
                case 'INBOUND':
                    // Create strategy to walk downstream
                    this.strategy = new ShoreWalkStrategy(
                        currentPos,
                        'downstream',
                        this.walkDistance, // Walk back same distance
                        this.speed,
                        () => {
                            this.state = 'END';
                            this.strategy = null;
                        }
                    );
                    break;
                case 'END':
                    // Create strategy to turn to face toward the shore (Direction 0)
                    this.strategy = new ShoreTurnStrategy(
                        currentPos,
                        0,
                        ROTATION_SPEED,
                        () => {
                            this.state = 'FINISHED';
                            this.strategy = null;
                        }
                    );
                    break;
                case 'FINISHED':
                    // Do nothing, will break loop and return finished
                    break;
            }
        }

        if (this.state === 'FINISHED' || !this.strategy) {
            return {
                path: { target: currentPos, speed: 0, locomotionType: 'LAND' },
                result: ShoreWalkLogic.RESULT_FINISHED,
                finish: true
            };
        }

        // Run current strategy (which could end)
        const steering = this.strategy.update(context);
        return {
            path: steering,
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.WALKING
    }
}
