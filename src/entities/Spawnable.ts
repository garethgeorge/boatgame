import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { PlacementHelper } from '../managers/PlacementHelper';

export interface SpawnContext {
  entityManager: EntityManager;
  physicsEngine: PhysicsEngine;
  placementHelper: PlacementHelper;
}

export interface Spawnable {
  id: string;

  /**
   * Determine how many of this obstacle to spawn in the given range.
   * @param context Context providing chunk info
   * @param difficulty Normalized difficulty (0.0 to 1.0)
   * @param zStart World Z start of range
   * @param zEnd World Z end of range
   */
  getSpawnCount(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): number;

  /**
   * Attempt to spawn the determined number of obstacles in the given range.
   * @param context Context providing systems and placement helper
   * @param count Number of obstacles to attempt to spawn
   * @param zStart World Z start of range
   * @param zEnd World Z end of range
   * @param biomeZRange World Z range of the biome
   */
  spawn(context: SpawnContext, count: number, zStart: number, zEnd: number, biomeZRange: [number, number]): Generator<void | Promise<void>, void, unknown>;

  /**
   * Ensures the models and assets required by this spawner are loaded.
   */
  ensureLoaded(): Generator<void | Promise<void>, void, unknown>;
}
