import { PopulationContext } from '../../world/biomes/PopulationContext';
import { MessageInABottle } from '../../entities/obstacles/MessageInABottle';

export class MessageInABottleSpawner {

    public static createEntity(
        context: PopulationContext, x: number, z: number, color?: number, points?: number
    ) {
        const bottle = new MessageInABottle(x, z, context.physicsEngine, color, points);
        context.entityManager.add(bottle);
    }
}
