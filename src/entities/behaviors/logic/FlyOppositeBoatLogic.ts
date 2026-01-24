import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { FlyToPointStrategy } from './strategy/FlightPathStrategies';
import { RiverSystem } from '../../../world/RiverSystem';

export interface FlyOppositeBoatParams {
    flightSpeed: number;
    flightHeight: number;
    distance: number;
}

/**
 * Logic that flies to a point in the river a specified distance from the
 * current position in the direction opposite to the boat's current heading.
 */
export class FlyOppositeBoatLogic implements AnimalLogic {
    public static readonly NAME = 'FlyOppositeBoatLogic';
    public static readonly RESULT_FINISHED = 'fly_opposite_boat_finished';
    readonly name = FlyOppositeBoatLogic.NAME;

    private flightSpeed: number;
    private distance: number;
    private flightHeight: number;

    private strategy: AnimalPathStrategy | null = null;
    private targetPos: planck.Vec2 | null = null;

    constructor(params: FlyOppositeBoatParams) {
        this.flightSpeed = params.flightSpeed;
        this.distance = params.distance;
        this.flightHeight = params.flightHeight;
    }

    activate(context: AnimalLogicContext): void {
        const boatVel = context.targetBody.getLinearVelocity();
        // Opposite to boat direction (Physics Y is longitudinal)
        // If boat is stopped, we assume it's moving upstream (-Y) and fly downstream (+Y)
        const boatDirY = boatVel.y || -1;
        const directionSign = -Math.sign(boatDirY);

        const targetZ = context.originPos.y + directionSign * this.distance;
        const banks = RiverSystem.getInstance().getBankPositions(targetZ);
        const riverCenter = (banks.left + banks.right) / 2;

        this.targetPos = new planck.Vec2(riverCenter, targetZ);
        this.strategy = new FlyToPointStrategy(this.targetPos, this.flightSpeed, this.flightHeight);
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        if (!this.strategy) {
            this.activate(context);
        }

        const steering = this.strategy!.update(context);
        const distToTarget = planck.Vec2.distance(context.originPos, this.targetPos!);

        // Arrival threshold
        if (distToTarget < 2.0) {
            return {
                path: steering,
                locomotionType: 'FLIGHT',
                finish: true,
                result: FlyOppositeBoatLogic.RESULT_FINISHED
            };
        }

        return {
            path: steering,
            locomotionType: 'FLIGHT'
        };
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.FLYING;
    }
}
