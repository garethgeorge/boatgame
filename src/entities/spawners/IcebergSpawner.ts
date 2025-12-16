import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Iceberg } from '../../entities/obstacles/Iceberg';

export class IcebergSpawner implements Spawnable {
  id = 'iceberg';

  getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
    // Only in Ice biome
    if (biomeType !== 'ice') return 0;

    // High chance in ice (0.30 per 15m in original)
    // 0.30 per 15m = 0.02 per meter.
    const baseDensity = 0.02;
    const count = chunkLength * baseDensity;

    return Math.floor(count + Math.random());
  }

  async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
    for (let i = 0; i < count; i++) {
      const radius = 2.0 + Math.random() * 3.0; // Large

      // Random placement across width
      const pos = context.placementHelper.tryPlace(context.zStart, context.zEnd, radius, {
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
