import * as planck from 'planck';
import { RiverSystem } from '../../world/RiverSystem';
import { Boat } from '../Boat';
import { AttackAnimalShoreIdle } from './AttackAnimal';
import { AnimalBehavior } from './AnimalBehavior';

export class AttackAnimalShoreIdleBehavior implements AnimalBehavior {
    private entity: AttackAnimalShoreIdle;
    private enterWaterDistance: number;

    constructor(
        entity: AttackAnimalShoreIdle,
        aggressiveness: number
    ) {
        this.entity = entity;
        this.enterWaterDistance = 100 + 100 * aggressiveness;
    }

    update() {
        const targetBody = Boat.getPlayerBody();
        const physicsBody = this.entity.getPhysicsBody();

        if (!targetBody || !physicsBody) return;

        const pos = physicsBody.getPosition();
        const target = targetBody.getPosition();
        const diff = target.clone().sub(pos);
        const dist = diff.length();

        // Activate when boat is within distance
        if (dist < this.enterWaterDistance) {
            // Let the entity decide what to do (e.g., create entering water behavior)
            this.entity.shouldStartEnteringWater();
        }
    }
}
