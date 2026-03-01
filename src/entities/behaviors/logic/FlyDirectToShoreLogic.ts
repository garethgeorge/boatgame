import * as planck from 'planck';
import { AnimalLogic, AnimalLogicContext, AnimalLogicPathResult, AnimalLogicPhase } from './AnimalLogic';
import { AnimalPathStrategy } from './strategy/AnimalPathStrategy';
import { FlyToShoreStrategy, PointLandingStrategy } from './strategy/FlightPathStrategies';

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
        this.strategy = new FlyToShoreStrategy(context.originPos, context.animal.getTerrainMap(), 15.0, this.flightSpeed, this.zRange);
    }

    update(context: AnimalLogicContext): AnimalLogicPathResult {
        if (this.state === 'FLYING') {
            const terrainMap = context.animal.getTerrainMap();
            const zone = terrainMap.getSurfaceInfo(context.originPos.x, context.originPos.y).zone;
            const shoreline = terrainMap.getNearestShoreline(context.originPos.x, context.originPos.y);
            const isOnShore = zone === 'land' && shoreline.distance > 15.0;

            if (isOnShore) {
                this.state = 'LANDING';

                // Pick a point near the current position on the shore
                const landingDist = 5.0 + Math.random() * 15.0; // At least 5, no more than 20
                const targetX = context.originPos.x - shoreline.normal.x * landingDist;
                const targetZ = context.originPos.y - shoreline.normal.y * landingDist;
                const targetPos = new planck.Vec2(targetX, targetZ);
                const targetHeight = terrainMap.getSurfaceInfo(targetX, targetZ).y;

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
        const terrainHeight = context.animal.getTerrainMap().getSurfaceInfo(context.originPos.x, context.originPos.y).y;
        const currentAltitude = Math.max(0, context.currentHeight - terrainHeight);
        return currentAltitude < 0.1 && context.physicsBody.getLinearVelocity().length() < 1.0;
    }
}
