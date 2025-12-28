import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { MessageInABottle } from '../../entities/obstacles/MessageInABottle';
import { RiverSystem } from '../../world/RiverSystem';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';

export class MessageInABottleSpawner extends BaseSpawner {
  id = 'bottle';

  protected getDensity(difficulty: number, zStart: number): number {
    return 1 / 400 + 1 / 400 * Math.random();
  }

  async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
    // Check for Bonus Arc (Rare event per chunk segment?)
    if (Math.random() < 0.1) {
      this.spawnBonusArc(context, zStart, zEnd);
    }
    await super.spawn(context, count, zStart, zEnd);
  }

  async spawnAt(context: SpawnContext, z: number): Promise<boolean> {
    return this.spawnInRiver(context, z, {});
  }

  /**
   * Spawns count bottle instances starting at zStart and placed zStep distance
   * apart.
   */
  async spawnRiverBottleArc(context: SpawnContext, count: number, zStart: number, zStep: number) {
    for (let i = 1; i <= count; i++) {
      const bz = zStart + i * zStep;
      const pos = context.placementHelper.tryPlace(bz, bz, 1.0, { center: 0, variation: 0.2 });
      if (pos) {
        const bottle = new MessageInABottle(pos.x, pos.z, context.physicsEngine, 0x00FF88, 50);
        context.entityManager.add(bottle, context.chunkIndex);
      }
    }
  }

  async spawnInRiver(context: SpawnContext, z: number, options: RiverPlacementOptions) {
    const opts = {
      minDistFromBank: 1.0,
      ...options
    };
    const pos = context.placementHelper.tryPlace(z, z, 1.0, opts);
    if (pos) {
      const bottle = new MessageInABottle(pos.x, pos.z, context.physicsEngine);
      context.entityManager.add(bottle, context.chunkIndex);
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
      context.entityManager.add(entity, context.chunkIndex);
    }
  }
}
