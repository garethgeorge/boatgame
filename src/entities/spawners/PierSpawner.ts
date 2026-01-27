import * as planck from 'planck';
import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Pier } from '../../entities/obstacles/Pier';
import { RiverSystem } from '../../world/RiverSystem';
import { Decorations } from '../../world/Decorations';

export class PierSpawner extends BaseSpawner {
  id = 'pier';

  protected getDensity(difficulty: number, zStart: number): number {
    const dist = Math.abs(zStart);
    if (dist < 200) return 0;
    return 0.0026;
  }

  *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    yield* Decorations.ensureAllLoaded(['depot']);
  }

  spawnAt(context: SpawnContext, worldZ: number, biomeZRange: [number, number], forceDepot?: boolean): boolean {
    const riverSystem = RiverSystem.getInstance();
    const minDepotPierLength = 13.0;

    const isLeft = Math.random() > 0.5;
    const width = riverSystem.getRiverWidth(worldZ);
    const center = riverSystem.getRiverCenter(worldZ);
    const slope = riverSystem.getRiverDerivative(worldZ);

    // Calculate Pier Geometry
    const bankX = center + (isLeft ? -width / 2 : width / 2);
    const maxPierLength = width * 0.6;

    // Randomly decide if this pier should have a depot
    const hasDepot = forceDepot ?? (maxPierLength > minDepotPierLength && Math.random() > 0.5);
    const minPierLength = hasDepot ? minDepotPierLength : 10.0;
    const pierLength = Math.min(minPierLength + Math.random() * 10, maxPierLength);

    if (pierLength < minPierLength && forceDepot) return false;

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
