import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Log } from '../../entities/obstacles/Log';

export class LogSpawner extends BaseSpawner {
  id = 'log';

  constructor(private readonly density: number = 0.003) {
    super();
  }

  protected getDensity(difficulty: number, zStart: number): number {
    return this.density;
  }

  async spawnAt(context: SpawnContext, z: number): Promise<boolean> {
    const length = 10 + Math.random() * 10;
    const pos = context.placementHelper.tryPlace(z, z, 3.0, {
      minDistFromBank: 2.0
    });

    if (pos) {
      const log = new Log(pos.x, pos.z, length, context.physicsEngine);
      context.entityManager.add(log, context.chunkIndex);
      return true;
    }
    return false;
  }
}
