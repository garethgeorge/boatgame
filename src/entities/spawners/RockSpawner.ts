import * as THREE from 'three';
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
    const isShore = Math.random() < 0.7;
    const side = Math.random() > 0.5 ? 1 : -1;
    const range: [number, number] = isShore ? [side * 0.5, side * 0.9] : [-0.3, 0.3];

    return this.spawnInRiver(context, z, false, '', { range });
  }

  async spawnInRiver(context: SpawnContext, z: number, pillars: boolean, biome: string,
    options: RiverPlacementOptions) {
    const opts = {
      minDistFromBank: 0.5,
      ...options
    }

    const radius = 1.5 + Math.random() * 3.0; // 1.5 to 4.5m
    const pos = context.placementHelper.tryPlace(z, z, radius, opts);
    if (pos) {
      const rock = new RiverRock(pos.x, pos.z, radius, pillars, biome, context.physicsEngine);
      context.entityManager.add(rock);
      return true;
    }
    return false;
  }
}
