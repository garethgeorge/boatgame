import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { MessageInABottle } from '../../entities/obstacles/MessageInABottle';
import { RiverSystem } from '../../world/RiverSystem';
import { RiverGeometrySample } from '../../world/RiverGeometry';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';
import { Decorations } from '../../world/Decorations';

export class MessageInABottleSpawner extends BaseSpawner {
  id = 'bottle';

  protected getDensity(difficulty: number, zStart: number): number {
    return 1 / 400 + 1 / 400 * Math.random();
  }

  *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
  }

  *spawn(context: SpawnContext, count: number, zStart: number, zEnd: number, biomeZRange: [number, number]): Generator<void, void, unknown> {
    // Check for Bonus Arc (Rare event per chunk segment?)
    if (Math.random() < 0.1) {
      this.spawnBonusArc(context, zStart, zEnd);
    }
    yield* super.spawn(context, count, zStart, zEnd, biomeZRange);
  }

  spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean {
    return this.spawnInRiver(context, z, {});
  }

  /**
   * Spawns count bottle instances starting at zStart and placed zStep distance
   * apart.
   */
  spawnRiverBottleArc(context: SpawnContext, count: number, zStart: number, zStep: number) {
    for (let i = 1; i <= count; i++) {
      const bz = zStart + i * zStep;
      const pos = context.placementHelper.tryPlace(bz, bz, 1.0, { range: [-0.2, 0.2] });
      if (pos) {
        const bottle = new MessageInABottle(pos.x, pos.z, context.physicsEngine, 0x00FF88, 50);
        context.entityManager.add(bottle);
      }
    }
  }

  spawnInRiver(context: SpawnContext, z: number, options: RiverPlacementOptions) {
    const opts = {
      minDistFromBank: 1.0,
      ...options
    };
    const pos = context.placementHelper.tryPlace(z, z, 1.0, opts);
    if (pos) {
      const bottle = new MessageInABottle(pos.x, pos.z, context.physicsEngine);
      context.entityManager.add(bottle);
      return true;
    }
    return false;
  }
  spawnInRiverAbsolute(
    context: SpawnContext,
    sample: RiverGeometrySample,
    distanceRange: [number, number]
  ): boolean {
    const radius = 1.0;
    const minSpacing = 1.0;
    const minDistFromShore = 1.0;

    const pos = context.placementHelper.tryRiverPlaceAbsolute(
      sample,
      radius,
      minSpacing,
      minDistFromShore,
      distanceRange
    );

    if (pos) {
      const bottle = new MessageInABottle(pos.worldX, pos.worldZ, context.physicsEngine);
      context.entityManager.add(bottle);
      return true;
    }
    return false;
  }

  private spawnBonusArc(context: SpawnContext, zStart: number, zEnd: number) {
    const riverSystem = RiverSystem.getInstance();
    const worldZ = zStart + Math.random() * (zEnd - zStart - 60); // Ensure space for arc

    const count = 8;
    const arcLength = 60;
    const spacing = arcLength / count;
    const riverWidth = riverSystem.getRiverWidth(worldZ);
    const amplitude = riverWidth * 0.15;
    const frequency = Math.PI / arcLength;
    const phase = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const dz = i * spacing;
      const currentZ = worldZ + dz;
      const currentCenter = riverSystem.getRiverCenter(currentZ);
      const offsetX = Math.sin(dz * frequency + phase) * amplitude;

      // No collision check for bonus arc (they are collectibles, can overlap obstacles slightly or just be placed)
      // But better to check?
      // Let's just place them.
      const entity = new MessageInABottle(currentCenter + offsetX, currentZ, context.physicsEngine, 0x0088FF, 50);
      context.entityManager.add(entity);
    }
  }
}
