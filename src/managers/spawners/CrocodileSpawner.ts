import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Alligator } from '../../entities/obstacles/Alligator';

export class CrocodileSpawner implements Spawnable {
  id = 'croc';

  getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
    // No crocs in ice
    if (biomeType === 'ice') return 0;

    // Start at 1000m
    const dist = Math.abs(context.zStart);
    if (dist < 1000) return 0;

    // Ramp: 0% -> 8% (0.08 per 15m)
    // 0.08 per 15m = 0.0053 per meter
    // We split the density between crocs and hippos, so use half: 0.00265
    // Ramp factor: (difficulty - 0.13) / (1 - 0.13)
    const ramp = Math.max(0, (difficulty - 0.13) / 0.87);
    const baseDensity = 0.00265 * ramp;

    const count = chunkLength * baseDensity;

    return Math.floor(count + Math.random());
  }

  async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
    for (let i = 0; i < count; i++) {
      // Cluster logic: 1 or 2
      const clusterSize = Math.random() > 0.5 ? 2 : 1;

      // Find a center for the cluster
      const centerPos = context.placementHelper.tryPlace(context.zStart, context.zEnd, 5.0, {
        minDistFromBank: 3.0
      });

      if (centerPos) {
        for (let j = 0; j < clusterSize; j++) {
          const offsetX = (Math.random() - 0.5) * 5;
          const offsetZ = (Math.random() - 0.5) * 5;

          const x = centerPos.x + offsetX;
          const z = centerPos.z + offsetZ;

          const angle = Math.random() * Math.PI * 2;
          const entity = new Alligator(x, z, context.physicsEngine, angle);
          context.entityManager.add(entity, context.chunkIndex);
        }
      }
    }
  }
}
