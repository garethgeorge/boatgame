import { PopulationContext } from '../../world/biomes/PopulationContext';
import { Iceberg } from '../../entities/obstacles/Iceberg';
import { Decorations } from '../../world/Decorations';

export class IcebergSpawner {
  id = 'iceberg';

  public static *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    yield* Decorations.ensureAllLoaded(['polarBear']);
  }

  public static createEntity(
    context: PopulationContext,
    x: number, z: number, radius: number, hasBear: boolean
  ) {
    const iceberg = new Iceberg(x, z, radius, hasBear, context.physicsEngine);
    context.entityManager.add(iceberg);
  }
}
