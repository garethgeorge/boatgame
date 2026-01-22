import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';
import { Log } from '../../entities/obstacles/Log';
import { RiverGeometrySample } from '../../world/RiverGeometry';

export class LogSpawner extends BaseSpawner {
  id = 'log';

  constructor(private readonly density: number = 0.003) {
    super();
  }

  protected getDensity(difficulty: number, zStart: number): number {
    return this.density;
  }

  spawnAt(context: SpawnContext, z: number): boolean {
    return this.spawnInRiver(context, z, {});
  }

  spawnInRiver(context: SpawnContext, z: number, options: RiverPlacementOptions) {
    const opts = {
      minDistFromBank: 2.0,
      ...options
    };
    const length = 10 + Math.random() * 10;
    const pos = context.placementHelper.tryPlace(z, z, length / 2, opts);
    if (pos) {
      const log = new Log(pos.x, pos.z, length, context.physicsEngine);
      context.entityManager.add(log);

      return true;
    }
    return false;
  }

  spawnInRiverAbsolute(
    context: SpawnContext,
    sample: RiverGeometrySample,
    distanceRange: [number, number]
  ): boolean {
    const length = 10 + Math.random() * 10;
    const radius = length / 2;
    const minSpacing = radius * 2.0;
    const minDistFromShore = 2.0;

    const pos = context.placementHelper.tryRiverPlaceAbsolute(
      sample,
      radius,
      minSpacing,
      minDistFromShore,
      distanceRange
    );

    if (pos) {
      const log = new Log(pos.worldX, pos.worldZ, length, context.physicsEngine);
      context.entityManager.add(log);
      return true;
    }
    return false;
  }

}
