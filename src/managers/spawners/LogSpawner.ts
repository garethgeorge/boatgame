import { Spawnable, SpawnContext, BiomeWeights } from '../Spawnable';
import { Log } from '../../entities/obstacles/Log';

export class LogSpawner implements Spawnable {
  id = 'log';

  getSpawnCount(context: SpawnContext, biomeWeights: BiomeWeights, difficulty: number, chunkLength: number): number {
    // Base probability: 0.04 per 15m step in original code.
    // Chunk size is usually larger. Let's assume chunk is ~150m?
    // Original loop: step=15, zStart to zEnd.
    // If chunk is 100m, that's ~6 steps. 6 * 0.04 = 0.24 logs per chunk?
    // Let's calculate based on density per meter.
    // 0.04 per 15m = 0.0026 per meter.
    // Length = zEnd - zStart.
    // Count = Length * 0.0026.

    // No logs in Ice biome
    if (biomeWeights.ice > 0.5) return 0;

    const baseDensity = 0.003; // Slightly higher than 0.0026
    const count = chunkLength * baseDensity;

    // Randomize slightly
    return Math.floor(count + Math.random());
  }

  async spawn(context: SpawnContext, count: number, biomeWeights: BiomeWeights): Promise<void> {
    for (let i = 0; i < count; i++) {
      const length = 10 + Math.random() * 10;
      // Logs are long, so radius is roughly half length for collision check purposes?
      // Or just use width. Log width is small (1-2m).
      // Let's use a radius of 3m for placement safety.

      const pos = context.placementHelper.tryPlace(context.zStart, context.zEnd, 3.0, {
        minDistFromBank: 2.0
      });

      if (pos) {
        const log = new Log(pos.x, pos.z, length, context.physicsEngine);
        context.entityManager.add(log);
      }
    }
  }
}
