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
import { AlligatorSpawner } from './spawners/AlligatorSpawner';
import { HippoSpawner } from './spawners/HippoSpawner';
import { MessageInABottleSpawner } from './spawners/MessageInABottleSpawner';
import { PenguinKayakSpawner } from './spawners/PenguinKayakSpawner';
import { AlligatorShoreSpawner } from './spawners/AlligatorShoreSpawner';
import { PolarBearShoreSpawner } from './spawners/PolarBearShoreSpawner';
import { BrownBearShoreSpawner } from './spawners/BrownBearShoreSpawner';
import { MangroveSpawner } from './spawners/MangroveSpawner';
import { MonkeyShoreSpawner } from './spawners/MonkeyShoreSpawner';
import { MooseShoreSpawner } from './spawners/MooseShoreSpawner';

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
    this.register(new PolarBearShoreSpawner());
    this.register(new AlligatorShoreSpawner());
    this.register(new BrownBearShoreSpawner());
    this.register(new MangroveSpawner());
    this.register(new MonkeyShoreSpawner());
    this.register(new MooseShoreSpawner());
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
