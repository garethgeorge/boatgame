import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Log } from '../../entities/obstacles/Log';

export class LogSpawner extends BaseSpawner {
  id = 'log';

  protected getDensity(difficulty: number, zStart: number): number {
    return 0.003;
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
