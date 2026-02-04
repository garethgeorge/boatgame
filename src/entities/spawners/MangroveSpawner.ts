import { SmallMangrove, LargeMangrove } from '../../entities/obstacles/Mangrove';
import { PopulationContext } from '../../world/biomes/PopulationContext';
import { EntityMetadata } from '../EntityMetadata';

export class MangroveSpawner {
  public static createEntity(context: PopulationContext, x: number, z: number, radius: number) {
    const scale = radius / EntityMetadata.mangrove.radius;
    if (scale > 1.05) {
      const mangrove = new LargeMangrove(x, z, scale, context.physicsEngine);
      context.entityManager.add(mangrove);
    } else {
      const mangrove = new SmallMangrove(x, z, scale, context.physicsEngine);
      context.entityManager.add(mangrove);
    }
  }
}

