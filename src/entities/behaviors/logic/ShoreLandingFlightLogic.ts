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
 * Flight logic runs until animal lands. Currently doesn't support a next logic.
 */
export class ShoreLandingFlightLogic implements AnimalLogic {
    public static readonly NAME = 'ShoreLandingFlightLogic';
    readonly name = ShoreLandingFlightLogic.NAME;

    private flightSpeed: number;
    private zRange?: [number, number];
    private state: 'TOWARD' | 'TIMEOUT' | 'AWAY' | 'TOSHORE' | 'LANDING' = 'TOWARD';
    private strategy: AnimalPathStrategy;
    private stateTimer: number = 0;

    constructor(params: ShoreLandingFlightParams) {
        this.flightSpeed = params.flightSpeed;
        this.strategy = new BuzzTargetStrategy(15.0, 2.5, 75.0, this.flightSpeed);
        this.zRange = params.zRange;
    }

    activate(context: AnimalLogicContext): void {
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        this.stateTimer -= context.dt;

        // Switch to direct to shore flight if out of z range
        if (this.state !== 'TOSHORE' && this.state !== 'LANDING' && this.zRange) {
            const z = context.originPos.y; // Physics Y is World Z
            if (z < this.zRange[0] || z > this.zRange[1]) {
                this.state = 'TOSHORE';
                this.strategy = new FlyToShoreStrategy(context.originPos, 15.0, this.flightSpeed, this.zRange);
            }
        }

        // If flying toward boat see if close enough and switch to away
        // If flying away or to shore and over the land switch to landing
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
            }
        } else if (this.state === 'AWAY' || this.state === 'TOSHORE') {
            const banks = RiverSystem.getInstance().getBankPositions(context.originPos.y);
            if (context.originPos.x < banks.left - 20.0 || context.originPos.x > banks.right + 20.0) {
                this.state = 'LANDING';
                this.strategy = new LandingStrategy(this.flightSpeed);
            }
        }

        // Update strategy
        const steering = this.strategy.update(context);

        // Get result
        if (this.hasLanded(context)) {
            return {
                path: steering,
                locomotionType: 'FLIGHT',
                result: 'DONE'
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
        const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(context.originPos.x, context.originPos.y);
        const currentAltitude = Math.max(0, context.currentHeight - terrainHeight);
        return currentAltitude < 0.1 && context.physicsBody.getLinearVelocity().length() < 1.0;
    }
}
