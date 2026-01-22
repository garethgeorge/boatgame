import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './AnimalPathStrategy';
import { BuzzTargetStrategy, FleeRiverStrategy, WaterLandingStrategy } from './FlightPathStrategies';
import { RiverSystem } from '../../../world/RiverSystem';

export interface WaterLandingFlightParams {
    flightSpeed: number;
    landingHeight: number;
}

export class WaterLandingFlightLogic implements AnimalLogic {
    public static readonly NAME = 'WaterLandingFlightLogic';
    readonly name = WaterLandingFlightLogic.NAME;
    private flightSpeed: number;
    private landingHeight: number;
    private state: 'TOWARD' | 'TIMEOUT' | 'AWAY' | 'LANDING' = 'TOWARD';
    private strategy: AnimalPathStrategy;
    private stateTimer: number = 0;

    constructor(params: WaterLandingFlightParams) {
        this.flightSpeed = params.flightSpeed;
        this.landingHeight = params.landingHeight;
        this.strategy = new BuzzTargetStrategy(15.0, 2.5, 75.0, this.flightSpeed);
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        this.stateTimer -= context.dt;

        // TOWARD -> AWAY (Close to boat)
        if (this.state === 'TOWARD' || this.state === 'TIMEOUT') {
            const distToBoat = planck.Vec2.distance(context.originPos, context.targetBody.getPosition());

            // Start timer if within flightSpeed distance
            if (this.state === 'TOWARD' && distToBoat < this.flightSpeed) {
                this.state = 'TIMEOUT';
                this.stateTimer = 5.0;
            } else if (this.state === 'TIMEOUT' && this.stateTimer < 0) {
                this.state = 'AWAY';
            }
            else if (distToBoat < 2.0) {
                this.state = 'AWAY';
            }
            if (this.state === 'AWAY') {
                this.strategy = new FleeRiverStrategy(15.0, this.flightSpeed);
                this.stateTimer = 2.0 + Math.random() * 3.0; // Fly for 2-5 seconds
            }
        }
        // AWAY -> LANDING (After timer)
        else if (this.state === 'AWAY') {
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
                result: 'DONE',
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
