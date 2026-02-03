import { SpawnContext } from '../Spawnable';
import { SmallMangrove, LargeMangrove } from '../../entities/obstacles/Mangrove';

export class MangroveSpawner {
  public static createEntity(context: SpawnContext, x: number, z: number, scale: number) {
    if (scale > 1.05) {
      const mangrove = new LargeMangrove(x, z, scale, context.physicsEngine);
      context.entityManager.add(mangrove);
    } else {
      const mangrove = new SmallMangrove(x, z, scale, context.physicsEngine);
      context.entityManager.add(mangrove);
    }
  }
}

