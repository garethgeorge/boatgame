import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { BuzzTargetStrategy } from './strategy/FlightPathStrategies';

export interface BuzzBoatFlightParams {
    flightSpeed: number;
    flightHeight?: number;      // height when flying toward
    buzzOffset?: number;        // parameters when getting close
    buzzHeight?: number;
    buzzTimeout?: number;
    zRange?: [number, number];
}

/**
 * Flys toward boat and buzzes it.
 * - Flies toward boat at flightHeight until within 50m
 * - Then flies toward the point buzzOffset from the boat at buzzHeight
 * - Finishes when either within 2m of the buzz point or has got close
 *   to the boat and the buzz timeout expired
 * - Returns out of range if the animal flies out of the z range
 */
export class BuzzBoatFlightLogic implements AnimalLogic {
    public static readonly RESULT_FINISHED = 'buzz_boat_finished';
    public static readonly RESULT_OUT_OF_RANGE = 'buzz_boat_out_of_range';
    readonly name = 'BuzzBoatFlight';

    private flightSpeed: number;
    private buzzTimeout: number;
    private buzzOffset: number;
    private zRange?: [number, number];
    private state: 'TOWARD' | 'TIMEOUT' | 'DONE' | 'OUT_OF_RANGE' = 'TOWARD';
    private strategy: AnimalPathStrategy;
    private stateTimer: number = 0;

    constructor(params: BuzzBoatFlightParams) {
        this.flightSpeed = params.flightSpeed;
        this.buzzTimeout = params.buzzTimeout ?? 5.0;
        this.buzzOffset = params.buzzOffset ?? 0;
        this.zRange = params.zRange;

        const {
            flightHeight = 15.0,
            buzzOffset = 0,
            buzzHeight = 2.5
        } = params;

        this.strategy = new BuzzTargetStrategy(flightHeight, buzzHeight, this.flightSpeed, buzzOffset);
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        this.stateTimer -= context.dt;

        if (this.state === 'TOWARD' || this.state === 'TIMEOUT') {
            const localPos = context.targetBody.getLocalPoint(context.originPos);
            const distToBuzzPoint = planck.Vec2.distance(localPos, planck.Vec2(0, -this.buzzOffset));

            // Start timer if within flightSpeed distance of the buzz point
            if (this.state === 'TOWARD' && distToBuzzPoint < this.flightSpeed) {
                this.state = 'TIMEOUT';
                this.stateTimer = this.buzzTimeout;
            } else if (this.state === 'TIMEOUT' && this.stateTimer < 0) {
                this.state = 'DONE';
            }
            else if (distToBuzzPoint < 2.0) {
                this.state = 'DONE';
            }

            if (this.zRange) {
                const z = context.originPos.y; // Physics Y is World Z
                if (z < this.zRange[0] || z > this.zRange[1]) {
                    this.state = 'OUT_OF_RANGE';
                }
            }
        }

        // Update strategy
        const steering = this.strategy.update(context);

        // Get result
        return {
            path: steering,
            locomotionType: 'FLIGHT',
            result: this.state === 'DONE' ? BuzzBoatFlightLogic.RESULT_FINISHED : (
                this.state === 'OUT_OF_RANGE' ? BuzzBoatFlightLogic.RESULT_OUT_OF_RANGE :
                    undefined
            )
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.FLYING;
    }
}
