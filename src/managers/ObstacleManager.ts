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
import { LogSpawner } from '../entities/spawners/LogSpawner';
import { RockSpawner } from '../entities/spawners/RockSpawner';
import { IcebergSpawner } from '../entities/spawners/IcebergSpawner';
import { PierSpawner } from '../entities/spawners/PierSpawner';
import { BuoySpawner } from '../entities/spawners/BuoySpawner';
import { AlligatorSpawner } from '../entities/spawners/AlligatorSpawner';
import { HippoSpawner } from '../entities/spawners/HippoSpawner';
import { MessageInABottleSpawner } from '../entities/spawners/MessageInABottleSpawner';
import { PenguinKayakSpawner } from '../entities/spawners/PenguinKayakSpawner';
import { PolarBearSpawner } from '../entities/spawners/PolarBearSpawner';
import { BrownBearSpawner } from '../entities/spawners/BrownBearSpawner';
import { MangroveSpawner } from '../entities/spawners/MangroveSpawner';
import { MonkeySpawner } from '../entities/spawners/MonkeySpawner';
import { MooseSpawner } from '../entities/spawners/MooseSpawner';
import { DucklingSpawner } from '../entities/spawners/DucklingSpawner';
import { TRexSpawner } from '../entities/spawners/TRexSpawner';

export class ObstacleManager {
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
    this.register(new AlligatorSpawner());
    this.register(new HippoSpawner());
    this.register(new MessageInABottleSpawner());
    this.register(new PenguinKayakSpawner());
    this.register(new PolarBearSpawner());
    this.register(new BrownBearSpawner());
    this.register(new MangroveSpawner());
    this.register(new MonkeySpawner());
    this.register(new MooseSpawner());
    this.register(new DucklingSpawner());
    this.register(new TRexSpawner());
  }

  private register(spawner: Spawnable) {
    this.registry.set(spawner.id, spawner);
  }

  // Called by TerrainManager when a new chunk is created
  public async spawnObstaclesForChunk(chunkIndex: number, zStart: number, zEnd: number) {
    Profiler.start('SpawnObstacles');
    // We don't check for existing chunk here because EntityManager handles duplicates/idempotency if needed,
    // but strictly speaking we rely on TerrainManager not calling this twice.
    // Or we could check if chunk has entities in EntityManager?
    // Let's trust TerrainManager for now.

    const placementHelper = new PlacementHelper();
    const chunkLength = zEnd - zStart;

    const context: SpawnContext = {
      entityManager: this.entityManager,
      physicsEngine: this.physicsEngine,
      placementHelper: placementHelper,
      chunkIndex: chunkIndex,
      zStart: zStart,
      zEnd: zEnd
    };

    // Calculate Biome Type (at center of chunk)
    const centerZ = (zStart + zEnd) / 2;
    const biomeType = this.riverSystem.biomeManager.getBiomeType(centerZ);

    // Calculate Difficulty
    const distance = Math.abs(centerZ);
    const difficulty = Math.min(distance / 7500, 1.0);

    // Iterate Spawners
    for (const spawner of this.registry.values()) {
      const count = spawner.getSpawnCount(context, biomeType, difficulty, chunkLength);
      if (count > 0) {
        await spawner.spawn(context, count, biomeType);
      }

      // Yield to main thread occasionally if needed?
      // Spawners are async, so we can await.
    }

    Profiler.end('SpawnObstacles');
  }

  // Called by TerrainManager when a chunk is disposed
  removeObstaclesForChunk(chunkIndex: number) {
    this.entityManager.removeChunk(chunkIndex);
  }
}
