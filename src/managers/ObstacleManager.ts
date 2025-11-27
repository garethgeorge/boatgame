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

      if (type < 0.1) {
        // Alligator
        this.entityManager.add(new Alligator(x, z, this.physicsEngine));
      } else if (type < 0.3) { // Expanded range since turtles are gone
        // Log
        // Much longer: 3x-6x original (which was ~3.5). So 10 to 20 range.
        const length = 10 + Math.random() * 10;
        this.entityManager.add(new Log(x, z, length, this.physicsEngine));
      } else if (type < 0.4) {
        // Pier (Attached to bank)
        // Decide left or right bank
        const isLeft = Math.random() > 0.5;
        const width = this.riverSystem.getRiverWidth(z);
        const center = this.riverSystem.getRiverCenter(z);

        // Calculate river slope (derivative)
        const slope = this.riverSystem.getRiverDerivative(z);
        // River tangent angle: atan(slope)
        // Normal angle is tangent + 90 deg (PI/2)
        const tangentAngle = Math.atan(slope);
        let normalAngle = tangentAngle + Math.PI / 2;

        // If left bank, we want to point towards center (or away from bank).
        // Tangent points downstream.
        // Left bank normal points towards center (+x relative to flow?).
        // Let's visualize: River flows +Z. Tangent ~0. Normal +X (PI/2).
        // If isLeft (negative X side), we want to point +X. So normalAngle is correct.
        // If isRight (positive X side), we want to point -X. So normalAngle + PI.

        if (!isLeft) {
          normalAngle += Math.PI;
        }

        const bankX = center + (isLeft ? -width / 2 : width / 2);

        const pierLength = 10 + Math.random() * 10;

        // Position: Start at bank, extend 'pierLength' along normal.
        // Center of pier is at start + normal * (pierLength/2)
        const dirX = Math.cos(normalAngle); // Note: In 2D physics, angle 0 is +X.
        // Wait, atan(dx/dz) gives angle from Z axis?
        // No, slope is dx/dz. tan(theta) = dx/dz. theta is angle from Z axis.
        // In Planck/Box2D, angle 0 is +X axis.
        // So if river flows +Z, angle is -PI/2 (270 deg) or +PI/2?
        // Let's stick to standard math.
        // Vector (dx, dz). Tangent vector T = (slope, 1). Normalized.
        // Normal vector N = (-1, slope) or (1, -slope).

        // Let's use vectors for safety.
        const T = planck.Vec2(slope, 1.0);
        T.normalize();

        let N = planck.Vec2(1.0, -slope); // Perpendicular to T
        N.normalize();

        // If isLeft, we are at x < center. We want to point towards center (approx +x).
        // Check dot product with +X axis (1,0).
        if (isLeft) {
          if (N.x < 0) N.mul(-1);
        } else {
          if (N.x > 0) N.mul(-1);
        }

        const angle = Math.atan2(N.y, N.x); // Physics angle (radians from +X)

        // Center position
        const startPos = planck.Vec2(bankX, z);
        const centerPos = startPos.clone().add(N.clone().mul(pierLength / 2));

        // Note: Pier constructor expects (x, y) where y is z-coord in 3D
        this.entityManager.add(new Pier(centerPos.x, centerPos.y, pierLength, angle, this.physicsEngine));
      } else if (type < 0.7) {
        // Gas Can
        this.entityManager.add(new GasCan(x, z, this.physicsEngine));
      } else {
        // Message in a Bottle
        this.entityManager.add(new MessageInABottle(x, z, this.physicsEngine));
      }
    }
  }
}
