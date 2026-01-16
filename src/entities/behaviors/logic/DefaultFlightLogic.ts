import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult } from './AnimalLogic';
import { AnimalPathStrategy } from './AnimalPathStrategy';
import { BuzzTargetStrategy, FleeRiverStrategy, LandingStrategy } from './FlightPathStrategies';
import { RiverSystem } from '../../../world/RiverSystem';

export interface DefaultFlightParams {
    flightSpeed: number;
}

export class DefaultFlightLogic implements AnimalLogic {
    public static readonly NAME = 'flight';
    readonly name = DefaultFlightLogic.NAME;

    /** Animal is in flight. */
    public static readonly ANIM_FLYING = 'flying';
    /** Animal is landing or on the ground. */
    public static readonly ANIM_WALKING = 'walking';

    private flightSpeed: number;
    private state: 'TOWARD' | 'AWAY' | 'LANDING' = 'TOWARD';
    private strategy: AnimalPathStrategy;

    constructor(params: DefaultFlightParams) {
        this.flightSpeed = params.flightSpeed;
        this.strategy = new BuzzTargetStrategy(15.0, 2.5, 75.0, this.flightSpeed);
    }

    shouldActivate(context: AnimalLogicContext): boolean {
        return true;
    }

    shouldDeactivate(context: AnimalLogicContext): boolean {
        return false;
    }

    update(context: AnimalLogicContext): void {
        this.strategy.update(context);

        if (this.state === 'TOWARD') {
            if (planck.Vec2.distance(context.originPos, context.targetBody.getPosition()) < 2.0) {
                this.state = 'AWAY';
                this.strategy = new FleeRiverStrategy(15.0, this.flightSpeed);
            }
        } else if (this.state === 'AWAY') {
            const banks = RiverSystem.getInstance().getBankPositions(context.originPos.y);
            if (context.originPos.x < banks.left - 20.0 || context.originPos.x > banks.right + 20.0) {
                this.state = 'LANDING';
                this.strategy = new LandingStrategy(this.flightSpeed);
            }
        }
    }

    calculatePath(context: AnimalLogicContext): AnimalLogicPathResult {
        const result = this.strategy.calculatePath(context);
        const anim = this.state === 'LANDING' ? DefaultFlightLogic.ANIM_WALKING : DefaultFlightLogic.ANIM_FLYING;
        return { ...result, locomotionType: 'FLIGHT', animationState: anim, isFinished: this.isFinished(context) };
    }

    private isFinished(context: AnimalLogicContext): boolean {
        if (this.state !== 'LANDING') return false;
        const currentAltitude = Math.max(0, context.currentHeight - RiverSystem.getInstance().terrainGeometry.calculateHeight(context.originPos.x, context.originPos.y));
        return currentAltitude < 0.1 && context.physicsBody.getLinearVelocity().length() < 1.0;
    }
}
