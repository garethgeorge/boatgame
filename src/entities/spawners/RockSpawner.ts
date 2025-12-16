import { Spawnable, SpawnContext, BiomeType } from '../../managers/Spawnable';
import { RiverRock } from '../obstacles/RiverRock';

export class RockSpawner implements Spawnable {
  id = 'rock';

  getSpawnCount(context: SpawnContext, biomeType: BiomeType, difficulty: number, chunkLength: number): number {
    // Original: 0.04 per 15m.
    // Replaced by Icebergs in Ice biome.
    if (biomeType === 'ice') return 0;

    const baseDensity = 0.003;
    const count = chunkLength * baseDensity;

    return Math.floor(count + Math.random());
  }

  async spawn(context: SpawnContext, count: number, biomeType: BiomeType): Promise<void> {
    for (let i = 0; i < count; i++) {
      const radius = 1.5 + Math.random() * 3.0; // 1.5 to 4.5m

      // Bias towards shores (70% chance)
      const bias = Math.random() < 0.7 ? (Math.random() > 0.5 ? 'left' : 'right') : 'center';
      const biasStrength = bias === 'center' ? 0 : 0.8; // Strong bias to banks

      const pos = context.placementHelper.tryPlace(context.zStart, context.zEnd, radius, {
        minDistFromBank: 0.5, // Can be closer to bank
        bias: bias as any,
        biasStrength: biasStrength
      });

      if (pos) {
        const rock = new RiverRock(pos.x, pos.z, radius, context.physicsEngine);
        context.entityManager.add(rock, context.chunkIndex);
      }
    }
  }
}
