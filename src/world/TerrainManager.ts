import { PhysicsEngine } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { SimplexNoise } from './SimplexNoise';
import { TerrainChunk } from './TerrainChunk';

export class TerrainManager {
  private chunks: Map<number, TerrainChunk> = new Map();
  private noise: SimplexNoise;
  private chunkSize = 100; // Must match TerrainChunk.CHUNK_SIZE
  private renderDistance = 6; // Number of chunks ahead/behind to keep

  constructor(
    private physicsEngine: PhysicsEngine,
    private graphicsEngine: GraphicsEngine
  ) {
    this.noise = new SimplexNoise();
  }

  update(boatZ: number) {
    // Calculate current chunk index
    // Boat moves in -Z direction usually? 
    // Wait, in Game.ts camera offset was +Z relative to boat.
    // Let's assume standard forward is -Z.
    // But let's check coordinate system.
    // If boat starts at 0,0 and moves "forward", we need to know which way is forward.
    // In Boat.ts: forward force is -y (which is -z in 3D).
    // So boat moves towards negative Z.

    const currentChunkIndex = Math.floor(boatZ / this.chunksSize);

    // We want chunks from [current - 1, current + renderDistance]
    // Since we move to negative Z, "ahead" is smaller indices (more negative).
    // So we want [current - renderDistance, current + 1]

    const minChunk = currentChunkIndex - this.renderDistance;
    const maxChunk = currentChunkIndex + 1; // Keep one behind

    // Create new chunks
    for (let i = minChunk; i <= maxChunk; i++) {
      if (!this.chunks.has(i)) {
        const zOffset = i * this.chunkSize;
        const chunk = new TerrainChunk(
          zOffset,
          this.physicsEngine,
          this.graphicsEngine,
          this.noise
        );
        this.chunks.set(i, chunk);
      }
    }

    // Remove old chunks
    for (const [index, chunk] of this.chunks) {
      if (index < minChunk || index > maxChunk) {
        chunk.dispose();
        this.chunks.delete(index);
      }
    }
  }

  // Getter for chunkSize to fix the typo above
  get chunksSize() {
    return this.chunkSize;
  }
}
