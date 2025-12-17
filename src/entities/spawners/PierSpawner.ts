import * as planck from 'planck';
import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Pier } from '../../entities/obstacles/Pier';
import { RiverSystem } from '../../world/RiverSystem';

export class PierSpawner implements Spawnable {
  id = 'pier';

  getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
    // No piers in ice
    if (biomeType === 'ice' || biomeType === 'jurassic') return 0;

    // Start after 200m
    const dist = Math.abs(context.zStart);
    if (dist < 200) return 0;

    // 0.04 per 15m = 0.0026 per meter
    const baseDensity = 0.0026;
    const count = chunkLength * baseDensity;

    return Math.floor(count + Math.random());
  }

  async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
    const riverSystem = RiverSystem.getInstance();

    for (let i = 0; i < count; i++) {
      // Piers need to be attached to the bank
      // Logic from original ObstacleManager

      const minDepotPierLength = 13.0;

      // We need to pick a Z first
      const worldZ = context.zStart + Math.random() * (context.zEnd - context.zStart);

      const isLeft = Math.random() > 0.5;
      const width = riverSystem.getRiverWidth(worldZ);
      const center = riverSystem.getRiverCenter(worldZ);
      const slope = riverSystem.getRiverDerivative(worldZ);

      // Calculate Pier Geometry
      const bankX = center + (isLeft ? -width / 2 : width / 2);
      const maxPierLength = width * 0.6;

      // Randomly decide if this pier should have a depot
      const hasDepot = maxPierLength > minDepotPierLength && Math.random() > 0.5;
      const minPierLength = hasDepot ? minDepotPierLength : 10.0;
      const pierLength = Math.min(minPierLength + Math.random() * 10, maxPierLength);

      // Calculate Angle
      let N = planck.Vec2(1.0, -slope);
      N.normalize();
      if (isLeft) { if (N.x < 0) N.mul(-1); }
      else { if (N.x > 0) N.mul(-1); }
      const angle = Math.atan2(N.y, N.x);

      const startPos = planck.Vec2(bankX, worldZ);
      const centerPos = startPos.clone().add(N.clone().mul(pierLength / 2));

      // Register with placement helper to avoid collisions
      // Approximate pier as a circle or just register the center?
      // Pier is a rectangle. Let's register a few circles along it?
      // Or just one big circle at the tip?
      // Let's register the tip area so boats don't spawn right on it.
      context.placementHelper.registerPlacement(centerPos.x, centerPos.y, pierLength / 2);

      const pier = new Pier(centerPos.x, centerPos.y, pierLength, angle, context.physicsEngine, hasDepot);
      context.entityManager.add(pier, context.chunkIndex);
    }
  }
}
