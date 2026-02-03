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

  spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean {
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
      this.createEntity(context, pos.x, pos.z, length);
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
      this.createEntity(context, pos.worldX, pos.worldZ, length);
      return true;
    }
    return false;
  }

  public createEntity(context: SpawnContext, x: number, z: number, length: number) {
    const log = new Log(x, z, length, context.physicsEngine);
    context.entityManager.add(log);
  }

}
