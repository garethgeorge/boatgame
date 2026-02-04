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
    worldZ: number,
    pierLength: number,
    isLeft: boolean,
    hasDepot: boolean
  ): boolean {
    const riverSystem = RiverSystem.getInstance();

    const width = riverSystem.getRiverWidth(worldZ);
    const center = riverSystem.getRiverCenter(worldZ);
    const slope = riverSystem.getRiverDerivative(worldZ);

    // Calculate Pier Geometry
    const bankX = center + (isLeft ? -width / 2 : width / 2);

    // Calculate Angle
    let N = planck.Vec2(1.0, -slope);
    N.normalize();
    if (isLeft) { if (N.x < 0) N.mul(-1); }
    else { if (N.x > 0) N.mul(-1); }
    const angle = Math.atan2(N.y, N.x);

    const startPos = planck.Vec2(bankX, worldZ);
    const centerPos = startPos.clone().add(N.clone().mul(pierLength / 2));

    // Register with placement helper to avoid collisions
    context.placementHelper.registerPlacement(centerPos.x, centerPos.y, pierLength / 2);

    const pier = new Pier(centerPos.x, centerPos.y, pierLength, angle, context.physicsEngine, hasDepot);
    context.entityManager.add(pier);

    return true;
  }
}
