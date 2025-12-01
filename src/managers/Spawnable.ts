import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { PlacementHelper } from './PlacementHelper';

export interface SpawnContext {
  entityManager: EntityManager;
  physicsEngine: PhysicsEngine;
  placementHelper: PlacementHelper;
  chunkIndex: number;
  zStart: number;
  zEnd: number;
}

export interface BiomeWeights {
  forest: number;
  desert: number;
  ice: number;
}

export interface Spawnable {
  id: string;

  /**
   * Determine how many of this obstacle to spawn in the given chunk range.
   * @param context Context providing chunk info
   * @param biomeWeights Biome weights at the center of the chunk (or average)
   * @param difficulty Normalized difficulty (0.0 to 1.0)
   * @param chunkLength Length of the chunk in meters
   */
  getSpawnCount(context: SpawnContext, biomeWeights: BiomeWeights, difficulty: number, chunkLength: number): number;

  /**
   * Attempt to spawn the determined number of obstacles.
   * @param context Context providing systems and placement helper
   * @param count Number of obstacles to attempt to spawn
   * @param biomeWeights Biome weights
   */
  spawn(context: SpawnContext, count: number, biomeWeights: BiomeWeights): Promise<void>;
}
