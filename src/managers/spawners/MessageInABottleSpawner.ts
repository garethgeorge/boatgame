import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { MessageInABottle } from '../../entities/obstacles/MessageInABottle';
import { RiverSystem } from '../../world/RiverSystem';

export class MessageInABottleSpawner implements Spawnable {
  id = 'bottle';

  getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
    // 0.04 per 15m = 0.0026 per meter (Normal)
    // 0.005 per 15m = 0.00033 per meter (Bonus)
    // Combined? Or separate bonus spawner?
    // Let's handle both here or separate.
    // Original code had separate probabilities.
    // Let's just do normal bottles here.

    const baseDensity = 0.0026;
    const count = chunkLength * baseDensity;

    return Math.floor(count + Math.random());
  }

  async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
    // Check for Bonus Arc (Rare event per chunk?)
    // Original: 0.005 probability per step.
    // Let's say 10% chance per chunk to have a bonus arc?
    if (Math.random() < 0.1) {
      this.spawnBonusArc(context);
    }

    // Normal Bottles
    for (let i = 0; i < count; i++) {
      const pos = context.placementHelper.tryPlace(context.zStart, context.zEnd, 1.0, {
        minDistFromBank: 1.0
      });

      if (pos) {
        const bottle = new MessageInABottle(pos.x, pos.z, context.physicsEngine);
        context.entityManager.add(bottle, context.chunkIndex);
      }
    }
  }

  private spawnBonusArc(context: SpawnContext) {
    const riverSystem = RiverSystem.getInstance();
    const worldZ = context.zStart + Math.random() * (context.zEnd - context.zStart - 60); // Ensure space for arc

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
