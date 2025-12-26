import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { RiverPlacementOptions } from '../../managers/PlacementHelper';
import { RiverRock } from '../../entities/obstacles/RiverRock';

export class RockSpawner extends BaseSpawner {
  id = 'rock';

  protected getDensity(difficulty: number, zStart: number): number {
    return 0.003;
  }

  async spawnAt(context: SpawnContext, z: number): Promise<boolean> {
    // Bias towards shores (70% chance)
    const bias = Math.random() < 0.7 ? (Math.random() > 0.5 ? 'left' : 'right') : 'center';
    const biasStrength = bias === 'center' ? 0 : 0.8; // Strong bias to banks

    return this.spawnInRiver(context, z, {
      minDistFromBank: 0.5, // Can be closer to bank
      bias: bias,
      biasStrength: biasStrength
    });
  }

  async spawnInRiver(context: SpawnContext, z: number, options: RiverPlacementOptions) {
    const radius = 1.5 + Math.random() * 3.0; // 1.5 to 4.5m
    const pos = context.placementHelper.tryPlace(z, z, radius, options);
    if (pos) {
      const rock = new RiverRock(pos.x, pos.z, radius, context.physicsEngine);
      context.entityManager.add(rock, context.chunkIndex);
      return true;
    }
    return false;
  }
}
