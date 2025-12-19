import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Iceberg } from '../../entities/obstacles/Iceberg';

export class IcebergSpawner extends BaseSpawner {
  id = 'iceberg';

  protected getDensity(difficulty: number, zStart: number): number {
    return 0.02;
  }

  async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const radius = 2.0 + Math.random() * 3.0; // Large

      const pos = context.placementHelper.tryPlace(zStart, zEnd, radius, {
        minDistFromBank: 1.0
      });

      if (pos) {
        const hasBear = Math.random() < 0.15;
        const iceberg = new Iceberg(pos.x, pos.z, radius, hasBear, context.physicsEngine);
        context.entityManager.add(iceberg, context.chunkIndex);
      }
    }
  }
}
