import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Iceberg } from '../../entities/obstacles/Iceberg';

export class IcebergSpawner extends BaseSpawner {
  id = 'iceberg';

  protected getDensity(difficulty: number, zStart: number): number {
    return 0.05;
  }

  spawnAt(context: SpawnContext, z: number): boolean {
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

      const iceberg = new Iceberg(pos.x, pos.z, radius, hasBear, context.physicsEngine);
      context.entityManager.add(iceberg);

      return true;
    }
    return false;
  }
}
