import * as planck from 'planck';
import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { RiverSystem } from '../world/RiverSystem';
import { Profiler } from '../core/Profiler';
import { TerrainChunk } from '../world/TerrainChunk';
import { Entity } from '../core/Entity';
import { Spawnable, SpawnContext } from './Spawnable';
import { PlacementHelper } from './PlacementHelper';

// Spawners
import { LogSpawner } from './spawners/LogSpawner';
import { RockSpawner } from './spawners/RockSpawner';
import { IcebergSpawner } from './spawners/IcebergSpawner';
import { PierSpawner } from './spawners/PierSpawner';
import { BuoySpawner } from './spawners/BuoySpawner';
import { CrocodileSpawner } from './spawners/CrocodileSpawner';
import { BottleSpawner } from './spawners/BottleSpawner';

export class ObstacleManager {
  private chunkEntities: Map<number, Entity[]> = new Map(); // Track entities per chunk
  private riverSystem: RiverSystem;
  private registry: Map<string, Spawnable> = new Map();

  constructor(
    private entityManager: EntityManager,
    private physicsEngine: PhysicsEngine
  ) {
    this.riverSystem = RiverSystem.getInstance();
    this.registerSpawners();
  }

  private registerSpawners() {
    this.register(new LogSpawner());
    this.register(new RockSpawner());
    this.register(new IcebergSpawner());
    this.register(new PierSpawner());
    this.register(new BuoySpawner());
    this.register(new CrocodileSpawner());
    this.register(new BottleSpawner());
  }

  private register(spawner: Spawnable) {
    this.registry.set(spawner.id, spawner);
  }

  // Called by TerrainManager when a new chunk is created
  public async spawnObstaclesForChunk(chunkIndex: number, zStart: number, zEnd: number) {
    Profiler.start('SpawnObstacles');
    if (this.chunkEntities.has(chunkIndex)) {
      Profiler.end('SpawnObstacles');
      return; // Already spawned
    }

    const entities: Entity[] = [];

    // Capture entities added during this process
    // We need to intercept entityManager.add or just track them manually?
    // The spawners call entityManager.add directly.
    // We can wrap entityManager or pass a proxy?
    // Or just ask spawners to return entities?
    // The interface says `spawn` returns Promise<void>.
    // Let's modify SpawnContext to include a way to track entities.
    // Actually, `SpawnContext` has `entityManager`. We can pass a proxy that tracks added entities.

    const trackedEntities: Entity[] = [];
    const entityProxy = {
      add: (entity: Entity) => {
        this.entityManager.add(entity);
        trackedEntities.push(entity);
      },
      remove: (entity: Entity) => {
        this.entityManager.remove(entity);
        const idx = trackedEntities.indexOf(entity);
        if (idx > -1) trackedEntities.splice(idx, 1);
      },
      entities: this.entityManager.entities // Read-only access if needed
    } as unknown as EntityManager; // Cast to satisfy type

    const placementHelper = new PlacementHelper();
    const chunkLength = zEnd - zStart;

    const context: SpawnContext = {
      entityManager: entityProxy,
      physicsEngine: this.physicsEngine,
      placementHelper: placementHelper,
      chunkIndex: chunkIndex,
      zStart: zStart,
      zEnd: zEnd
    };

    // Calculate Biome Weights (at center of chunk)
    const centerZ = (zStart + zEnd) / 2;
    const weights = TerrainChunk.getBiomeWeights(centerZ);
    const biomeWeights = {
      forest: weights.forest,
      desert: weights.desert,
      ice: weights.ice
    };

    // Calculate Difficulty
    const distance = Math.abs(centerZ);
    const difficulty = Math.min(distance / 7500, 1.0);

    // Iterate Spawners
    for (const spawner of this.registry.values()) {
      const count = spawner.getSpawnCount(context, biomeWeights, difficulty, chunkLength);
      if (count > 0) {
        await spawner.spawn(context, count, biomeWeights);
      }

      // Yield to main thread occasionally if needed?
      // Spawners are async, so we can await.
    }

    if (trackedEntities.length > 0) {
      this.chunkEntities.set(chunkIndex, trackedEntities);
    }

    Profiler.end('SpawnObstacles');
  }

  // Called by TerrainManager when a chunk is disposed
  removeObstaclesForChunk(chunkIndex: number) {
    const entities = this.chunkEntities.get(chunkIndex);
    if (entities) {
      for (const entity of entities) {
        this.entityManager.remove(entity);
      }
      this.chunkEntities.delete(chunkIndex);
    }
  }
}
