import * as planck from 'planck';
import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { RiverSystem } from '../world/RiverSystem';
import { Profiler } from '../core/Profiler';
import { Spawnable, SpawnContext } from '../entities/Spawnable';
import { PlacementHelper } from './PlacementHelper';

// Spawners logic moved to BiomeFeatures

export class ObstacleManager {
  private riverSystem: RiverSystem;
  private registry: Map<string, Spawnable> = new Map();

  constructor(
    private entityManager: EntityManager,
    private physicsEngine: PhysicsEngine
  ) {
    this.riverSystem = RiverSystem.getInstance();
  }

  // Called by TerrainManager when a new chunk is created
  public async spawnObstaclesForChunk(chunkIndex: number, zStart: number, zEnd: number) {
    Profiler.start('SpawnObstacles');
    // We don't check for existing chunk here because EntityManager handles duplicates/idempotency if needed,
    // but strictly speaking we rely on TerrainManager not calling this twice.
    // Or we could check if chunk has entities in EntityManager?
    // Let's trust TerrainManager for now.

    const placementHelper = new PlacementHelper(this.physicsEngine.world);
    const chunkLength = zEnd - zStart;
    const segments = this.riverSystem.biomeManager.getFeatureSegments(zStart, zEnd);

    // Calculate Difficulty
    const centerZ = (zStart + zEnd) / 2;
    const distance = Math.abs(centerZ);
    const difficulty = Math.min(distance / 7500, 1.0);

    for (const segment of segments) {
      const context: SpawnContext = {
        entityManager: this.entityManager,
        physicsEngine: this.physicsEngine,
        placementHelper: placementHelper,
        chunkIndex: chunkIndex,
        zStart: zStart,
        zEnd: zEnd,
        biomeZStart: segment.biomeZStart,
        biomeZEnd: segment.biomeZEnd,
        biomeLayout: this.riverSystem.biomeManager.getLayoutForBiome(
          segment.biomeIndex,
          segment.biomeZStart,
          segment.biomeZEnd
        )
      };

      const features = this.riverSystem.biomeManager.getFeatures(segment.biome);
      await features.spawn(context, difficulty, segment.zStart, segment.zEnd);
    }

    Profiler.end('SpawnObstacles');
  }

  // Called by TerrainManager when a chunk is disposed
  removeInRange(zMin: number, zMax: number) {
    this.entityManager.removeEntitiesInRange(zMin, zMax);
  }
}
