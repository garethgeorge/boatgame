import * as planck from 'planck';
import { SpawnContext } from '../SpawnContext';
import { Pier } from '../../entities/obstacles/Pier';
import { RiverSystem } from '../../world/RiverSystem';
import { Decorations } from '../../world/Decorations';

export class PierSpawner {
  public static *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    yield* Decorations.ensureAllLoaded(['depot']);
  }

  public static createEntity(
    context: SpawnContext,
    x: number, z: number, length: number, angle: number,
    hasDepot: boolean
  ): boolean {

    const pier = new Pier(x, z, length, angle, context.physicsEngine, hasDepot);
    context.entityManager.add(pier);
    return true;
  }
}
