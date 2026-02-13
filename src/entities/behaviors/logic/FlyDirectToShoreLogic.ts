import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { FlyToShoreStrategy, PointLandingStrategy } from './strategy/FlightPathStrategies';
import { RiverSystem } from '../../../world/RiverSystem';

export interface FlyDirectToShoreParams {
    flightSpeed: number;
    zRange?: [number, number];
}

/**
 * Flight logic runs until animal lands.
 */
export class FlyDirectToShoreLogic implements AnimalLogic {
    public static readonly RESULT_FINISHED = 'fly_direct_to_shore_finished';
    readonly name = 'FlyDirectToShore';

    private flightSpeed: number;
    private zRange?: [number, number];
    private state: 'FLYING' | 'LANDING' = 'FLYING';
    private strategy: AnimalPathStrategy;

    constructor(params: FlyDirectToShoreParams) {
        this.flightSpeed = params.flightSpeed;
        this.zRange = params.zRange;
    }

    activate(context: AnimalLogicContext): void {
        this.strategy = new FlyToShoreStrategy(context.originPos, 15.0, this.flightSpeed, this.zRange);
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        if (this.state === 'FLYING') {
            const banks = RiverSystem.getInstance().getBankPositions(context.originPos.y);
            const isOnShore = context.originPos.x < banks.left - 15.0 || context.originPos.x > banks.right + 15.0;
            if (isOnShore) {
                this.state = 'LANDING';

                // Pick a point near the current position on the shore
                const landingDist = 5.0 + Math.random() * 15.0; // At least 5, no more than 20
                const targetX = context.originPos.x < banks.left ? banks.left - landingDist : banks.right + landingDist;
                const targetZ = context.originPos.y;
                const targetPos = new planck.Vec2(targetX, targetZ);
                const targetHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(targetX, targetZ);

                this.strategy = new PointLandingStrategy(
                    context,
                    this.flightSpeed,
                    targetPos,
                    targetHeight,
                    context.currentHeight // Use current height for flight height
                );
            }
        }

        // Update strategy
        const steering = this.strategy.update(context);

        // Get result
        if (this.hasLanded(context)) {
            return {
                path: steering,
                result: FlyDirectToShoreLogic.RESULT_FINISHED
            };
        } else {
            return {
                path: steering,
            };
        }
    }

    getPhase(): AnimalLogicPhase {
        return AnimalLogicPhase.FLYING;
    }

    private hasLanded(context: AnimalLogicContext): boolean {
        const terrainHeight = RiverSystem.getInstance().terrainGeometry.calculateHeight(context.originPos.x, context.originPos.y);
        const currentAltitude = Math.max(0, context.currentHeight - terrainHeight);
        return currentAltitude < 0.1 && context.physicsBody.getLinearVelocity().length() < 1.0;
    }
}
