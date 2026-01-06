import * as planck from 'planck';
import { Boat } from '../../Boat';
import { AnimalAttackParams } from '../AnimalBehaviorUtils';
import { AttackPathStrategy, SternInterceptStrategy, ShoreHuggingStrategy, LurkingStrategy, AttackPathResult } from './AttackPathStrategies';
import { AttackLogic } from './AttackLogic';

type AmbushState = 'STALKING' | 'LURKING' | 'STRIKING';

/**
 * "Ambush" attack logic: 
 * 1. Move toward the boat hugging the shore (STALKING).
 * 2. Lie in wait when at a certain distance, facing the boat (LURKING).
 * 3. Strike the stern when the boat is close enough (STRIKING).
 */
export class AmbushAttackLogic extends AttackLogic {
    readonly name = 'ambush';
    private currentStrategy: AttackPathStrategy;
    private state: AmbushState = 'STALKING';

    constructor() {
        super();
        this.currentStrategy = new ShoreHuggingStrategy();
    }

    override update(dt: number, originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, aggressiveness: number) {
        const boatPos = targetBody.getPosition();
        const distToBoat = planck.Vec2.distance(attackPointWorld, boatPos);
        const localPos = targetBody.getLocalPoint(attackPointWorld);

        switch (this.state) {
            case 'STALKING':
                // Move toward boat until we are reasonably close but still ahead
                if (distToBoat < 4 * Boat.LENGTH && localPos.y < Boat.BOW_Y) {
                    this.state = 'LURKING';
                    this.currentStrategy = new LurkingStrategy();
                }
                break;

            case 'LURKING':
                // If boat gets very close, strike!
                if (distToBoat < 2 * Boat.LENGTH) {
                    this.state = 'STRIKING';
                    const interceptFactor = 0.4 + (aggressiveness * 0.6);
                    this.currentStrategy = new SternInterceptStrategy(interceptFactor);
                } else if (distToBoat > 8 * Boat.LENGTH || localPos.y > Boat.STERN_Y) {
                    // Lost them or overshot? Go back to stalking or abort
                    this.state = 'STALKING';
                    this.currentStrategy = new ShoreHuggingStrategy();
                }
                break;

            case 'STRIKING':
                // Already in strike strategy
                break;
        }
    }

    override calculateTarget(originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): AttackPathResult {
        return this.currentStrategy.calculateTarget(originPos, attackPointWorld, targetBody, params);
    }

    override shouldAbort(originPos: planck.Vec2, attackPointWorld: planck.Vec2, targetBody: planck.Body, params: AnimalAttackParams): boolean {
        // In STRIKING, use the strategy's abort logic
        if (this.state === 'STRIKING') {
            return this.currentStrategy.shouldAbort(originPos, attackPointWorld, targetBody, params);
        }

        // In other states, abort if we are way behind the boat
        const localPos = targetBody.getLocalPoint(attackPointWorld);
        return localPos.y > Boat.STERN_Y + 15.0;
    }
}
