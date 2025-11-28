import * as planck from 'planck';
import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { RiverSystem } from '../world/RiverSystem';
import { Alligator, Turtle, Log, Pier, Buoy } from '../entities/Obstacles';
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

      if (type < 0.05) {
        // Chained Buoys (Anchored to bank)
        // "Attached to one bank... never cross more than 50% of the river's width"

        const isLeft = Math.random() > 0.5;
        const riverWidth = this.riverSystem.getRiverWidth(z);
        const riverCenter = this.riverSystem.getRiverCenter(z);

        // Bank X position
        const bankX = riverCenter + (isLeft ? -riverWidth / 2 : riverWidth / 2);

        // Direction towards center
        const direction = isLeft ? 1 : -1;

        // Max length is 50% width
        const maxLength = riverWidth * 0.5;
        const chainLength = (0.3 + Math.random() * 0.2) * riverWidth; // 30-50% width

        const spacing = 4.0; // 4 meters between buoys
        const buoyCount = Math.floor(chainLength / spacing);

        // Create Anchor Body (Static)
        const anchorBody = this.physicsEngine.world.createBody({
          type: 'static',
          position: planck.Vec2(bankX, z)
        });

        // We don't need to add anchor to entities list as it has no mesh/logic, just physics
        // But we need to track it to destroy it when chunk is removed?
        // ObstacleManager tracks 'Entity[]'. Anchor is just a Body.
        // We can create a dummy Entity for the anchor or just attach the first buoy to a fixed point?
        // If we attach to a static body, that body needs to be destroyed.
        // Let's create a simple Anchor entity class or just track bodies?
        // The current system tracks Entity objects and calls remove(entity) which destroys body.
        // Let's make a simple Anchor entity class or just use a dummy Entity.
        // Actually, we can just use the first buoy as the anchor if we make it static?
        // But user said "buoy's float... constraints linking... boat can push them".
        // So buoys should be dynamic. The anchor is the bank.
        // Let's create a hidden Anchor entity.

        // Create a simple concrete Entity for the anchor
        class AnchorEntity extends Entity {
          constructor(body: planck.Body) {
            super();
            this.physicsBody = body;
          }
          update(dt: number) { }
          onHit() { }
        }

        const anchorEntity = new AnchorEntity(anchorBody);
        this.entityManager.add(anchorEntity);
        entities.push(anchorEntity);

        let prevBody = anchorBody;

        for (let i = 1; i <= buoyCount; i++) {
          const dist = i * spacing;
          const bx = bankX + direction * dist;

          // Add some jitter to Z
          const jitterZ = (Math.random() - 0.5) * 1.0;

          const buoy = new Buoy(bx, z + jitterZ, this.physicsEngine);
          this.entityManager.add(buoy);
          entities.push(buoy);

          // Connect to previous
          const joint = planck.DistanceJoint({
            frequencyHz: 2.0, // Slight springiness
            dampingRatio: 0.5,
            collideConnected: false
          }, prevBody, buoy.physicsBody, prevBody.getPosition(), buoy.physicsBody.getPosition());

          this.physicsEngine.world.createJoint(joint);

          prevBody = buoy.physicsBody;
        }

      } else if (type < 0.3) {
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
        // Collectables
        // 2% chance for Bonus Bottle Arc (Blue) - Reduced from 10%
        if (Math.random() < 0.02) {
          const count = 8;
          const arcLength = 60; // Spans 60 meters
          const spacing = arcLength / count;
          const riverWidth = this.riverSystem.getRiverWidth(z);
          const riverCenter = this.riverSystem.getRiverCenter(z);

          // Sine wave parameters
          const amplitude = riverWidth * 0.15; // Use 15% of width
          const frequency = Math.PI / arcLength; // Half sine wave over the length
          const phase = Math.random() * Math.PI * 2;

          for (let i = 0; i < count; i++) {
            const dz = i * spacing;
            const currentZ = z + dz;

            // Calculate X based on sine wave relative to river center at that Z
            // We need to query river center at currentZ for accuracy
            const currentCenter = this.riverSystem.getRiverCenter(currentZ);
            const offsetX = Math.sin(dz * frequency + phase) * amplitude;

            const entity = new MessageInABottle(currentCenter + offsetX, currentZ, this.physicsEngine, 0x0088FF, 50); // Blue, 50 pts
            this.entityManager.add(entity);
            entities.push(entity);
          }

          // Skip ahead to avoid overlapping normal spawns?
          // The loop increments by 'step' (15). We just spawned 40m worth.
          // But 'z' is the loop variable. We can't easily modify it here without side effects if we don't return or adjust.
          // But it's fine, overlapping is rare and okay.

        } else {
          // Normal Message in a Bottle (Green)
          const entity = new MessageInABottle(x, z, this.physicsEngine);
          this.entityManager.add(entity);
          entities.push(entity);
        }
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
