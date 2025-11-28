import * as planck from 'planck';
import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { RiverSystem } from '../world/RiverSystem';
import { TerrainChunk } from '../world/TerrainChunk';
import { Alligator, Turtle, Log, Pier, Buoy, RiverRock, Iceberg } from '../entities/Obstacles';
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
      // Difficulty Calculation (0.0 to 1.0 over 7500m)
      const distance = Math.abs(z);
      const difficulty = Math.min(distance / 7500, 1.0);

      // Biome Weights
      const weights = TerrainChunk.getBiomeWeights(z);

      // Independent Spawn Rates (Probability per step)
      // Base rates (Constant)
      const pierProb = (distance > 200 ? 0.04 : 0) * (1 - weights.ice); // No piers in ice
      const rockProb = 0.04 * (1 - weights.ice); // Rocks replaced by Icebergs in ice
      const logProb = 0.04 * (1 - weights.ice); // Logs replaced by Icebergs
      const bottleProb = 0.04;
      const bonusProb = 0.005;
      const icebergProb = 0.30 * weights.ice; // High chance in ice (Tripled from 0.10)

      // Dynamic rates (Ramp with difficulty)
      // Buoys: 0% -> 8% (Start at 500m)
      const buoyProb = (distance > 500 ? 0.08 * Math.max(0, (difficulty - 0.06) / (1 - 0.06)) : 0) * (1 - weights.ice);

      // Crocs: 0% -> 8% (Start at 1000m)
      const crocProb = (distance > 1000 ? 0.08 * Math.max(0, (difficulty - 0.13) / (1 - 0.13)) : 0) * (1 - weights.ice);

      const probs: { [key: string]: number } = {
        'pier': pierProb,
        'rock': rockProb,
        'log': logProb,
        'bottle': bottleProb,
        'buoy': buoyProb,
        'croc': crocProb,
        'bonus': bonusProb,
        'iceberg': icebergProb
      };

      // Calculate Total Probability
      let totalProb = 0;
      for (const key in probs) totalProb += probs[key];

      // Debug Log (First few spawns)
      if (Math.random() < 0.001) {
        console.log(`[ObstacleManager] z=${z.toFixed(1)} dist=${distance.toFixed(1)} diff=${difficulty.toFixed(3)} totalProb=${totalProb.toFixed(3)}`);
      }

      // Determine if we spawn anything
      if (Math.random() > totalProb) continue;

      // Select Type (Normalized Weights)
      let random = Math.random() * totalProb;
      let type = 'bottle'; // Default

      for (const key in probs) {
        random -= probs[key];
        if (random <= 0) {
          type = key;
          break;
        }
      }

      // Defensive Gating (Double check)
      if (type === 'croc' && distance < 1000) {
        type = 'log';
      }
      if (type === 'buoy' && distance < 500) {
        type = 'log';
      }

      const center = this.riverSystem.getRiverCenter(z);
      const width = this.riverSystem.getRiverWidth(z);
      const safeWidth = width * 0.7;
      const x = center + (Math.random() - 0.5) * safeWidth;

      if (type === 'buoy') {
        // Chained Buoys (Anchored to bank)
        const isLeft = Math.random() > 0.5;
        const riverWidth = this.riverSystem.getRiverWidth(z);
        const riverCenter = this.riverSystem.getRiverCenter(z);
        const bankX = riverCenter + (isLeft ? -riverWidth / 2 : riverWidth / 2);
        const direction = isLeft ? 1 : -1;
        const chainLength = (0.3 + Math.random() * 0.2) * riverWidth; // 30-50% width
        const spacing = 4.0;
        const buoyCount = Math.floor(chainLength / spacing);

        const anchorBody = this.physicsEngine.world.createBody({
          type: 'static',
          position: planck.Vec2(bankX, z)
        });

        // Anchor Entity (Hidden)
        class AnchorEntity extends Entity {
          constructor(body: planck.Body) { super(); this.physicsBody = body; }
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
          const jitterZ = (Math.random() - 0.5) * 1.0;
          const buoy = new Buoy(bx, z + jitterZ, this.physicsEngine);
          this.entityManager.add(buoy);
          entities.push(buoy);

          const joint = planck.DistanceJoint({
            frequencyHz: 2.0,
            dampingRatio: 0.5,
            collideConnected: false
          }, prevBody, buoy.physicsBody, prevBody.getPosition(), buoy.physicsBody.getPosition());
          this.physicsEngine.world.createJoint(joint);
          prevBody = buoy.physicsBody;
        }

      } else if (type === 'croc') {
        // Alligator Cluster
        const count = Math.random() > 0.5 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const offsetX = (Math.random() - 0.5) * 5;
          const offsetZ = (Math.random() - 0.5) * 5;
          const entity = new Alligator(x + offsetX, z + offsetZ, this.physicsEngine);
          this.entityManager.add(entity);
          entities.push(entity);
        }

      } else if (type === 'log') {
        // Log
        const length = 10 + Math.random() * 10;
        const entity = new Log(x, z, length, this.physicsEngine);
        this.entityManager.add(entity);
        entities.push(entity);

      } else if (type === 'pier') {
        // Pier
        const isLeft = Math.random() > 0.5;
        const width = this.riverSystem.getRiverWidth(z);
        const center = this.riverSystem.getRiverCenter(z);
        const slope = this.riverSystem.getRiverDerivative(z);
        const tangentAngle = Math.atan(slope);
        let normalAngle = tangentAngle + Math.PI / 2;
        if (!isLeft) normalAngle += Math.PI;

        const bankX = center + (isLeft ? -width / 2 : width / 2);
        const maxPierLength = width * 0.6;
        const pierLength = Math.min(10 + Math.random() * 10, maxPierLength);

        let N = planck.Vec2(1.0, -slope);
        N.normalize();
        if (isLeft) { if (N.x < 0) N.mul(-1); }
        else { if (N.x > 0) N.mul(-1); }
        const angle = Math.atan2(N.y, N.x);

        const startPos = planck.Vec2(bankX, z);
        const centerPos = startPos.clone().add(N.clone().mul(pierLength / 2));

        const entity = new Pier(centerPos.x, centerPos.y, pierLength, angle, this.physicsEngine);
        this.entityManager.add(entity);
        entities.push(entity);

      } else if (type === 'bonus') {
        // Bonus Bottle Arc
        const count = 8;
        const arcLength = 60;
        const spacing = arcLength / count;
        const riverWidth = this.riverSystem.getRiverWidth(z);
        const amplitude = riverWidth * 0.15;
        const frequency = Math.PI / arcLength;
        const phase = Math.random() * Math.PI * 2;

        for (let i = 0; i < count; i++) {
          const dz = i * spacing;
          const currentZ = z + dz;
          const currentCenter = this.riverSystem.getRiverCenter(currentZ);
          const offsetX = Math.sin(dz * frequency + phase) * amplitude;
          const entity = new MessageInABottle(currentCenter + offsetX, currentZ, this.physicsEngine, 0x0088FF, 50);
          this.entityManager.add(entity);
          entities.push(entity);
        }

      } else if (type === 'rock') {
        // River Rock
        // Bias towards shores
        const isShore = Math.random() < 0.7; // 70% chance near shore
        let rockX = x;

        if (isShore) {
          const riverWidth = this.riverSystem.getRiverWidth(z);
          const riverCenter = this.riverSystem.getRiverCenter(z);
          const side = Math.random() > 0.5 ? 1 : -1;
          // Place in outer 20% of river
          const offset = (riverWidth / 2) * (0.8 + Math.random() * 0.2);
          rockX = riverCenter + side * offset;
        }

        const radius = 1.5 + Math.random() * 3.0; // 1.5 to 4.5m radius (3x larger)
        const entity = new RiverRock(rockX, z, radius, this.physicsEngine);
        this.entityManager.add(entity);
        entities.push(entity);

      } else if (type === 'iceberg') {
        // Iceberg
        // Similar placement to rocks (bias towards shores? or everywhere?)
        // Icebergs drift, so they can be anywhere.
        // Let's place them randomly across width.
        const radius = 2.0 + Math.random() * 3.0; // Large
        const entity = new Iceberg(x, z, radius, this.physicsEngine);
        this.entityManager.add(entity);
        entities.push(entity);

      } else {
        // Normal Bottle
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
