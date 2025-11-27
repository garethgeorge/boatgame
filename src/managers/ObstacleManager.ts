import * as planck from 'planck';
import { EntityManager } from '../core/EntityManager';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { RiverSystem } from '../world/RiverSystem';
import { Alligator, Turtle, Log, Pier } from '../entities/Obstacles';
import { GasCan, MessageInABottle } from '../entities/Collectables';

export class ObstacleManager {
  private spawnedChunks: Set<number> = new Set();
  private readonly CHUNK_SIZE = 100; // Smaller chunks for obstacle density control
  private riverSystem: RiverSystem;

  constructor(
    private entityManager: EntityManager,
    private physicsEngine: PhysicsEngine
  ) {
    this.riverSystem = RiverSystem.getInstance();
  }

  update(boatZ: number) {
    const currentChunk = Math.floor(boatZ / this.CHUNK_SIZE);
    const spawnDistance = 5; // Spawn 5 chunks ahead

    // Spawn new chunks
    for (let i = -1; i <= spawnDistance; i++) {
      const chunkIndex = currentChunk + i;
      if (!this.spawnedChunks.has(chunkIndex)) {
        this.spawnChunk(chunkIndex);
        this.spawnedChunks.add(chunkIndex);
      }
    }

    // Cleanup old chunks (optional, but entities clean themselves up? No, we need to remove them)
    // For now, let's just keep spawning. Entities are lightweight-ish.
    // Ideally we should cull entities behind the player.
    // The EntityManager doesn't auto-cull.
    // Let's implement culling later if needed, or just rely on a simple distance check in Game.ts

    // Actually, let's cull here.
    if (this.spawnedChunks.size > 20) {
      const minChunk = currentChunk - 5;
      for (const chunk of this.spawnedChunks) {
        if (chunk < minChunk) {
          this.spawnedChunks.delete(chunk);
          // We'd need to track which entities belong to which chunk to remove them efficiently.
          // For now, let's just rely on the EntityManager to handle updates and maybe add a "cull" method there.
        }
      }
    }
  }

  private spawnChunk(chunkIndex: number) {
    const zStart = chunkIndex * this.CHUNK_SIZE;
    const zEnd = zStart + this.CHUNK_SIZE;

    // Randomly spawn items in this chunk
    // Randomly spawn items in this chunk
    // Adjusted density based on user feedback (was too high)
    const step = 15; // Increased from 5 to 15 to reduce clutter

    for (let z = zStart; z < zEnd; z += step) {
      if (Math.random() > 0.6) continue; // 40% chance to spawn per step

      const type = Math.random();
      const center = this.riverSystem.getRiverCenter(z);
      const width = this.riverSystem.getRiverWidth(z);

      // Safe water width (avoid banks)
      const safeWidth = width * 0.7;
      const x = center + (Math.random() - 0.5) * safeWidth;

      if (type < 0.3) {
        // Alligator Cluster
        // Spawn 1-2 alligators close to each other
        const count = Math.random() > 0.5 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          const offsetX = (Math.random() - 0.5) * 5;
          const offsetZ = (Math.random() - 0.5) * 5;
          // Ensure within bounds?
          // x is already random within safeWidth.
          // Just add offset.
          this.entityManager.add(new Alligator(x + offsetX, z + offsetZ, this.physicsEngine));
        }
      } else if (type < 0.5) { // Expanded range
        // Log
        // Much longer: 3x-6x original (which was ~3.5). So 10 to 20 range.
        const length = 10 + Math.random() * 10;
        this.entityManager.add(new Log(x, z, length, this.physicsEngine));
      } else if (type < 0.6) {
        // Pier (Attached to bank)
        // ... (Pier logic remains same, just copy it or leave it if I can target ranges)
        // I'll just copy the pier logic to be safe since I'm replacing the block.

        // Decide left or right bank
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

        const pierLength = 10 + Math.random() * 10;

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

        this.entityManager.add(new Pier(centerPos.x, centerPos.y, pierLength, angle, this.physicsEngine));
      } else {
        // Message in a Bottle (Rest of probability)
        this.entityManager.add(new MessageInABottle(x, z, this.physicsEngine));
      }
    }
  }
}
