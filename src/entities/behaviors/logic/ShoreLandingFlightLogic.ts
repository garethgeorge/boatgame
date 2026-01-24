import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { BuzzTargetStrategy, FleeRiverStrategy, FlyToShoreStrategy, LandingStrategy } from './strategy/FlightPathStrategies';
import { RiverSystem } from '../../../world/RiverSystem';

export interface ShoreLandingFlightParams {
    flightSpeed: number;
    zRange?: [number, number];
}

/**
 * Flight logic runs until animal lands.
 */
export class ShoreLandingFlightLogic implements AnimalLogic {
    public static readonly RESULT_FINISHED = 'shore_landing_finished';
    public static readonly RESULT_OUT_OF_RANGE = 'shore_landing_out_of_range';
    readonly name = 'ShoreLandingFlight';

    private flightSpeed: number;
    private zRange?: [number, number];
    private state: 'AWAY' | 'LANDING' | 'OUT_OF_RANGE' = 'AWAY';
    private strategy: AnimalPathStrategy;

    constructor(params: ShoreLandingFlightParams) {
        this.flightSpeed = params.flightSpeed;
        this.strategy = new FleeRiverStrategy(15.0, this.flightSpeed);
        this.zRange = params.zRange;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        if (this.state === 'AWAY') {
            // switch to landing if sufficiently over the shore
            const banks = RiverSystem.getInstance().getBankPositions(context.originPos.y);
            if (context.originPos.x < banks.left - 20.0 || context.originPos.x > banks.right + 20.0) {
                this.state = 'LANDING';
                this.strategy = new LandingStrategy(this.flightSpeed);
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
        if (this.hasLanded(context)) {
            return {
                path: steering,
                locomotionType: 'FLIGHT',
                result: ShoreLandingFlightLogic.RESULT_FINISHED
            };
        } else {
            return {
                path: steering,
                locomotionType: 'FLIGHT',
                result: this.state === 'OUT_OF_RANGE' ? ShoreLandingFlightLogic.RESULT_OUT_OF_RANGE :
                    undefined
            };
        }
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.FLYING;
    }

    private hasLanded(context: AnimalLogicContext): boolean {
        if (this.state !== 'LANDING') return false;
        const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(context.originPos.x, context.originPos.y);
        const currentAltitude = Math.max(0, context.currentHeight - terrainHeight);
        return currentAltitude < 0.1 && context.physicsBody.getLinearVelocity().length() < 1.0;
    }
}
