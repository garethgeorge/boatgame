import { Spawnable, SpawnContext, BiomeType } from '../Spawnable';
import { Mangrove } from '../../entities/obstacles/Mangrove';
import { RiverSystem } from '../../world/RiverSystem';

export class MangroveSpawner implements Spawnable {
  id = 'mangrove';

  getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number {
    const chunkLength = zEnd - zStart;
    return Math.floor(chunkLength * (14 / 62.5)); // Approx 14 per 62.5m chunk
  }

  async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
    const riverSystem = RiverSystem.getInstance();

    for (let i = 0; i < count; i++) {
      const z = zStart + Math.random() * (zEnd - zStart);

      // Get river width and center at this Z
      const riverWidth = riverSystem.getRiverWidth(z);
      const riverCenter = riverSystem.getRiverCenter(z);

      // Spawn across full width + 10m overlap on each side
      const spawnWidth = riverWidth + 20; // width + 10 + 10
      const x = riverCenter + (Math.random() - 0.5) * spawnWidth;

      // Keep a small clear channel in the middle for navigation
      // Check distance from center
      if (Math.abs(x - riverCenter) < 6) continue;

      const mangrove = new Mangrove(x, z, context.physicsEngine);
      context.entityManager.add(mangrove);
    }
  }
}

