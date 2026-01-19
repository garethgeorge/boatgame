import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicConfig, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './AnimalPathStrategy';
import { ShoreWalkStrategy, ShoreTurnStrategy } from './ShoreWalkStrategy';

export interface ShoreWalkParams {
    walkDistance: number;
    speed: number; // Walk speed
}

type ShoreWalkState = 'START' | 'OUTBOUND' | 'TURN' | 'INBOUND' | 'END' | 'FINISHED';

/**
 * Shore walk runs until walk completed then returns the next logic
 */
export class ShoreWalkLogic implements AnimalLogic {
    public static readonly NAME = 'shorewalk';

    readonly name = ShoreWalkLogic.NAME;

    private strategy: AnimalPathStrategy | null = null;
    private walkDistance: number;
    private speed: number;

    private state: ShoreWalkState = 'START';

    constructor(params: ShoreWalkParams) {
        this.walkDistance = params.walkDistance;
        this.speed = params.speed;
    }

    activate(context: AnimalLogicContext) {
        this.state = 'START';
        this.strategy = null;
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        const currentPos = context.originPos;
        const ROTATION_SPEED = 2.0;

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
                path: { target: currentPos, speed: 0 },
                locomotionType: 'LAND',
                result: 'DONE',
                finish: true
            };
        }

        // Run current strategy (which could end)
        const steering = this.strategy.update(context);
        return {
            path: steering,
            locomotionType: 'LAND'
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.WALKING
    }
}

