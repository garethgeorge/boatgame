import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';
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
    return this.spawnInRiver(context, z, {});
  }

  async spawnInRiver(context: SpawnContext, z: number, options: RiverPlacementOptions) {
    const opts = {
      minDistFromBank: 2.0,
      ...options
    };
    const length = 10 + Math.random() * 10;
    const pos = context.placementHelper.tryPlace(z, z, length / 2, opts);
    if (pos) {
      const log = new Log(pos.x, pos.z, length, context.physicsEngine);
      context.entityManager.add(log, context.chunkIndex);
      return true;
    }
    return false;
  }

}
