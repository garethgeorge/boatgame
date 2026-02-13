import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { FlyToPointStrategy, WanderStrategy } from './strategy/FlightPathStrategies';
import { RiverSystem } from '../../../world/RiverSystem';
import { AnimalBehaviorUtils } from '../AnimalBehaviorUtils';

export interface WanderingFlightParams {
    flightSpeed: number;
    noticeDistance?: number;
    noticeDelay?: number;
    wanderRadius?: number;
    wanderHeight?: number;
    moveToCenter?: boolean;
}

export class WanderingFlightLogic implements AnimalLogic {
    public static readonly RESULT_NOTICED = 'wandering_noticed';
    readonly name = 'WanderingFlight';

    private flightSpeed: number;
    private noticeDistance: number;
    private noticeDelay: number;
    private wanderRadius: number;
    private wanderHeight: number;
    private moveToCenter: boolean;

    private state: 'MOVING' | 'WANDERING' = 'WANDERING';
    private strategy: AnimalPathStrategy;
    private centerPos: planck.Vec2;

    constructor(params: WanderingFlightParams) {
        this.flightSpeed = params.flightSpeed;
        this.noticeDistance = params.noticeDistance ?? 50.0;
        this.noticeDelay = params.noticeDelay ?? 0.0;
        this.wanderRadius = params.wanderRadius ?? 20.0;
        this.wanderHeight = params.wanderHeight ?? 15.0;
        this.moveToCenter = params.moveToCenter ?? false;
    }

    activate(context: AnimalLogicContext): void {
        this.centerPos = context.originPos.clone();

        if (this.moveToCenter) {
            this.state = 'MOVING';
            this.centerPos = this.pickNewWanderCenter(this.centerPos);
            this.strategy = new FlyToPointStrategy(this.centerPos, this.flightSpeed, this.wanderHeight);
        } else {
            this.state = 'WANDERING';
            this.strategy = new WanderStrategy(this.centerPos, this.wanderRadius, this.flightSpeed, this.wanderHeight);
        }
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {

        this.noticeDelay -= context.dt;

        const distToBoat = AnimalBehaviorUtils.distanceToBoat(context.originPos, context.targetBody);

        // Check for boat
        if (this.noticeDelay <= 0 && distToBoat < this.noticeDistance) {
            return {
                path: this.strategy.update(context),
                result: WanderingFlightLogic.RESULT_NOTICED
            };
        }

        if (this.state === 'MOVING') {
            const distToTarget = planck.Vec2.distance(context.originPos, this.centerPos);
            if (distToTarget < 2.0) {
                this.state = 'WANDERING';
                this.strategy = new WanderStrategy(this.centerPos, this.wanderRadius, this.flightSpeed, this.wanderHeight);
            }
        }

        const steering = this.strategy.update(context);

        return {
            path: steering,
        };
    }

    private pickNewWanderCenter(currentPos: planck.Vec2): planck.Vec2 {
        const riverSystem = RiverSystem.getInstance();

        // Pick a random y and get bank positions
        const y = currentPos.y + (Math.random() - 0.5) * 20.0;
        const banks = riverSystem.getBankPositions(y);

        // Pick a random x inside
        const width = banks.right - banks.left;
        const margin = Math.min(10.0, (width - 2) / 2);
        const minX = banks.left + margin;
        const maxX = banks.right - margin;
        const x = Math.max(minX, Math.min(maxX, currentPos.x + (Math.random() - 0.5) * 10.0));

        return new planck.Vec2(x, y);
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.FLYING;
    }
}
