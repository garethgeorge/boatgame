import { SpawnContext } from '../SpawnContext';
import { Iceberg } from '../../entities/obstacles/Iceberg';
import { Decorations } from '../../world/Decorations';

export class IcebergSpawner {
  id = 'iceberg';

  public static *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    yield* Decorations.ensureAllLoaded(['polarBear']);
  }

  public static *spawn(context: SpawnContext, count: number, zStart: number, zEnd: number, biomeZRange: [number, number]): Generator<void, void, unknown> {
    for (let i = 0; i < count; i++) {
      if (i % 5 === 0) yield;
      const z = zStart + Math.random() * (zEnd - zStart);
      this.spawnAt(context, z, biomeZRange);
    }
  }

  public static spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean {
    let radius = 4.0 + Math.random();

    // Size Variance
    let scaleMultiplier = 1.0;
    let hasBear = false;
    const r = Math.random();
    if (r < 0.05) {
      scaleMultiplier = 3.0;
      hasBear = Math.random() < 0.5;
    } else if (r < 0.30) {
      scaleMultiplier = 1.5;
    }
    radius *= scaleMultiplier;

    const pos = context.placementHelper.tryPlace(z, z, radius, {
      minDistFromBank: 1.0
    });

    if (pos) {

      this.createEntity(context, pos.x, pos.z, radius, hasBear);
      return true;
    }
    return false;
  }

  public static createEntity(
    context: SpawnContext,
    x: number, z: number, radius: number, hasBear: boolean
  ) {
    const iceberg = new Iceberg(x, z, radius, hasBear, context.physicsEngine);
    context.entityManager.add(iceberg);
  }
}
