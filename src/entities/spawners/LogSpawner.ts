import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Log } from '../../entities/obstacles/Log';

export class LogSpawner implements Spawnable {
  id = 'log';

  getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
    const chunkLength = zEnd - zStart;
    const baseDensity = 0.003;
    const count = chunkLength * baseDensity;
    return Math.floor(count + Math.random());
  }

  async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const length = 10 + Math.random() * 10;
      const pos = context.placementHelper.tryPlace(zStart, zEnd, 3.0, {
        minDistFromBank: 2.0
      });

      if (pos) {
        const log = new Log(pos.x, pos.z, length, context.physicsEngine);
        context.entityManager.add(log, context.chunkIndex);
      }
    }
  }
}
