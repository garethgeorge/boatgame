import * as planck from 'planck';
import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { RiverSystem } from '../world/RiverSystem';
import { Alligator, Turtle, Log, Pier } from '../entities/Obstacles';
import { GasCan, MessageInABottle } from '../entities/Collectables';
import { Entity } from '../core/Entity';

export class ObstacleManager {
  private chunkEntities: Map<number, Entity[]> = new Map(); // Track entities per chunk
  private riverSystem: RiverSystem;

  constructor(
    private entityManager: EntityManager,
    private physicsEngine: PhysicsEngine
  ) {
    this.riverSystem = RiverSystem.getInstance();
  }

  // Called by TerrainManager when a new chunk is created
  spawnObstaclesForChunk(chunkIndex: number, zStart: number, zEnd: number) {
    if (this.chunkEntities.has(chunkIndex)) return; // Already spawned

    const entities: Entity[] = [];
    const step = 15;

    for (let z = zStart; z < zEnd; z += step) {
      if (Math.random() > 0.6) continue;

      const type = Math.random();
      const center = this.riverSystem.getRiverCenter(z);
      const width = this.riverSystem.getRiverWidth(z);

      // Safe water width (avoid banks)
      const safeWidth = width * 0.7;
      const x = center + (Math.random() - 0.5) * safeWidth;

      if (type < 0.3) {
        // Alligator Cluster
        const count = Math.random() > 0.5 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const offsetX = (Math.random() - 0.5) * 5;
          const offsetZ = (Math.random() - 0.5) * 5;
          const entity = new Alligator(x + offsetX, z + offsetZ, this.physicsEngine);
          this.entityManager.add(entity);
          entities.push(entity);
        }
      } else if (type < 0.5) {
        // Log
        const length = 10 + Math.random() * 10;
        const entity = new Log(x, z, length, this.physicsEngine);
        this.entityManager.add(entity);
        entities.push(entity);
      } else if (type < 0.6) {
        // Pier (Attached to bank)
        const isLeft = Math.random() > 0.5;
        const width = this.riverSystem.getRiverWidth(z);
        const center = this.riverSystem.getRiverCenter(z);

        const slope = this.riverSystem.getRiverDerivative(z);
        const tangentAngle = Math.atan(slope);
        let normalAngle = tangentAngle + Math.PI / 2;

        if (!isLeft) {
          normalAngle += Math.PI;
        }

        const bankX = center + (isLeft ? -width / 2 : width / 2);

        const maxPierLength = width * 0.6;
        const pierLength = Math.min(10 + Math.random() * 10, maxPierLength);

        const T = planck.Vec2(slope, 1.0);
        T.normalize();

        let N = planck.Vec2(1.0, -slope);
        N.normalize();

        if (isLeft) {
          if (N.x < 0) N.mul(-1);
        } else {
          if (N.x > 0) N.mul(-1);
        }

        const angle = Math.atan2(N.y, N.x);

        const startPos = planck.Vec2(bankX, z);
        const centerPos = startPos.clone().add(N.clone().mul(pierLength / 2));

        const entity = new Pier(centerPos.x, centerPos.y, pierLength, angle, this.physicsEngine);
        this.entityManager.add(entity);
        entities.push(entity);
      } else {
        // Message in a Bottle
        const entity = new MessageInABottle(x, z, this.physicsEngine);
        this.entityManager.add(entity);
        entities.push(entity);
      }
    }

    if (entities.length > 0) {
      this.chunkEntities.set(chunkIndex, entities);
    }
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
