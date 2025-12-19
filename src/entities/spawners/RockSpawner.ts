import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { RiverRock } from '../../entities/obstacles/RiverRock';

export class RockSpawner extends BaseSpawner {
  id = 'rock';

  protected getDensity(difficulty: number, zStart: number): number {
    return 0.003;
  }

  async spawn(context: SpawnContext, count: number, zStart: number, zEnd: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const radius = 1.5 + Math.random() * 3.0; // 1.5 to 4.5m

      // Bias towards shores (70% chance)
      const bias = Math.random() < 0.7 ? (Math.random() > 0.5 ? 'left' : 'right') : 'center';
      const biasStrength = bias === 'center' ? 0 : 0.8; // Strong bias to banks

      const pos = context.placementHelper.tryPlace(zStart, zEnd, radius, {
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
