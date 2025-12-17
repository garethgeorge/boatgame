import * as planck from 'planck';
import { RiverSystem } from '../../world/RiverSystem';
import { Boat } from '../Boat';
import { AttackAnimalShoreIdle } from './AttackAnimal';
import { EntityBehavior } from './EntityBehavior';

export class AttackAnimalShoreIdleBehavior implements EntityBehavior {
    private entity: AttackAnimalShoreIdle;
    private enterWaterDistance: number = 0.0;

    constructor(
        entity: AttackAnimalShoreIdle,
        aggressiveness: number
    ) {
        this.entity = entity;
        if (aggressiveness > 0.0) {
            this.enterWaterDistance = 100 + 100 * aggressiveness;
        }
    }

    update(dt: number) {
        if (this.enterWaterDistance <= 0) {
            this.perhapsShouldSwitchBehavior(dt);
        } else {
            if (!this.perhapsShouldEnterWater(dt)) {
                this.perhapsShouldSwitchBehavior(dt);
            }
        }
    }

    private perhapsShouldEnterWater(dt: number): boolean {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return false;

        const pos = physicsBody.getPosition();
        const target = targetBody.getPosition();
        const diff = target.clone().sub(pos);
        const dist = diff.length();

        // Activate when boat is within distance
        if (dist < this.enterWaterDistance) {
            // Let the entity decide what to do (e.g., create entering water behavior)
            return this.entity.shoreIdleMaybeStartEnteringWater?.();
        }

        return false;
    }

    private perhapsShouldSwitchBehavior(dt: number) {
        // Probability such that average time is 5 seconds
        const probability = dt / 5.0;
        if (Math.random() < probability) {
            this.entity.shoreIdleMaybeSwitchBehavior?.();
        }
    }
}
