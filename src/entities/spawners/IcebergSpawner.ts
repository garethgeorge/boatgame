import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Iceberg } from '../../entities/obstacles/Iceberg';

export class IcebergSpawner implements Spawnable {
  id = 'iceberg';

  getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
    const chunkLength = zEnd - zStart;
    const baseDensity = 0.02;
    const count = chunkLength * baseDensity;
    return Math.floor(count + Math.random());
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
