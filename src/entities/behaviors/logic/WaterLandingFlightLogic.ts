import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { BuzzTargetStrategy, FleeRiverStrategy, WaterLandingStrategy } from './strategy/FlightPathStrategies';
import { RiverSystem } from '../../../world/RiverSystem';

export interface WaterLandingFlightParams {
    flightSpeed: number;
    landingHeight: number;
}

export class WaterLandingFlightLogic implements AnimalLogic {
    public static readonly RESULT_FINISHED = 'water_landing_finished';
    readonly name = 'WaterLandingFlight';

    private flightSpeed: number;
    private landingHeight: number;
    private state: 'AWAY' | 'LANDING' = 'AWAY';
    private strategy: AnimalPathStrategy;
    private stateTimer: number = 0;

    constructor(params: WaterLandingFlightParams) {
        this.flightSpeed = params.flightSpeed;
        this.landingHeight = params.landingHeight;
    }

    activate(context: AnimalLogicContext): void {
        this.strategy = new FleeRiverStrategy(15.0, this.flightSpeed);
        this.stateTimer = 2.0 + Math.random() * 3.0; // Fly for 2-5 seconds
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        this.stateTimer -= context.dt;

        // AWAY -> LANDING (After timer)
        if (this.state === 'AWAY') {
            if (this.stateTimer <= 0) {
                this.state = 'LANDING';
                this.strategy = new WaterLandingStrategy(this.flightSpeed, this.landingHeight);
            }
        }

        // Update strategy
        const steering = this.strategy.update(context);

        // Get result
        if (this.hasLanded(context)) {
            return {
                path: steering,
                locomotionType: 'FLIGHT',
                result: WaterLandingFlightLogic.RESULT_FINISHED,
                finish: true
            };
        } else {
            return {
                path: steering,
                locomotionType: 'FLIGHT',
            };
        }
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.FLYING;
    }

    private hasLanded(context: AnimalLogicContext): boolean {
        if (this.state !== 'LANDING') return false;
        // Water landing is simple - just height and speed check
        const currentAltitude = Math.abs(context.currentHeight - this.landingHeight);
        return currentAltitude < 0.1 && context.physicsBody.getLinearVelocity().length() < 1.0;
    }
}
