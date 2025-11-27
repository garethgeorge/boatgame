import * as THREE from 'three';
import * as planck from 'planck';
import { PhysicsEngine } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { SimplexNoise } from './SimplexNoise';
import { TerrainChunk } from './TerrainChunk';

export class TerrainManager {
  private chunks: Map<number, TerrainChunk> = new Map();
  private noise: SimplexNoise;
  private chunkSize = 500; // Must match TerrainChunk.CHUNK_SIZE
  private renderDistance = 3; // Number of chunks ahead/behind to keep

  // Collision Management
  private activeCollisionSegments: Map<number, { bodies: planck.Body[], meshes: THREE.Mesh[] }> = new Map();
  private collisionStep = 5; // Distance between collision points
  private collisionRadius = 150; // Radius around boat to generate collision

  constructor(
    private physicsEngine: PhysicsEngine,
    private graphicsEngine: GraphicsEngine
  ) {
    this.noise = new SimplexNoise();
  }

  update(boatZ: number) {
    this.updateChunks(boatZ);
    this.updateCollision(boatZ);
  }

  private updateChunks(boatZ: number) {
    const currentChunkIndex = Math.floor(boatZ / this.chunksSize);
    const minChunk = currentChunkIndex - this.renderDistance;
    const maxChunk = currentChunkIndex + 1;

    // Create new chunks
    for (let i = minChunk; i <= maxChunk; i++) {
      if (!this.chunks.has(i)) {
        const zOffset = i * this.chunkSize;
        const chunk = new TerrainChunk(
          zOffset,
          this.graphicsEngine,
          this.noise
        );
        this.chunks.set(i, chunk);
      }
    }

    // Remove old chunks
    for (const [index, chunk] of this.chunks) {
      if (index < minChunk || index > maxChunk) {
        // chunk.dispose(); // TerrainChunk doesn't have dispose yet, but we should implement it if needed
        // For now just removing from map and letting GC handle it (meshes are in scene though)
        // We need to remove meshes from scene.
        // TerrainChunk should have a dispose method.
        // Let's assume it handles it or we just leak for now (refactor later).
        // Actually, TerrainChunk adds to graphicsEngine. It should remove.
        this.graphicsEngine.remove(chunk.mesh);
        this.graphicsEngine.remove(chunk.waterMesh);
        this.chunks.delete(index);
      }
    }
  }

  private getRiverOffset(z: number): number {
    return this.noise.noise2D(0, z * 0.002) * 100;
  }

  private updateCollision(boatZ: number) {
    // Generate collision segments around the boat
    const startZ = Math.floor((boatZ - this.collisionRadius) / this.collisionStep) * this.collisionStep;
    const endZ = Math.ceil((boatZ + this.collisionRadius) / this.collisionStep) * this.collisionStep;

    // Add new segments
    for (let z = startZ; z < endZ; z += this.collisionStep) {
      if (!this.activeCollisionSegments.has(z)) {
        const segment = this.createCollisionSegment(z, z + this.collisionStep);
        this.activeCollisionSegments.set(z, segment);
        segment.meshes.forEach(m => this.graphicsEngine.add(m));
      }
    }

    // Remove old segments
    for (const [z, segment] of this.activeCollisionSegments) {
      if (z < startZ || z > endZ) {
        segment.bodies.forEach(b => this.physicsEngine.world.destroyBody(b));
        segment.meshes.forEach(m => this.graphicsEngine.remove(m));
        // Dispose geometries and materials
        segment.meshes.forEach(m => {
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose());
          } else {
            m.material.dispose();
          }
        });
        this.activeCollisionSegments.delete(z);
      }
    }
  }

  private createCollisionSegment(zStart: number, zEnd: number): { bodies: planck.Body[], meshes: THREE.Mesh[] } {
    const bodies: planck.Body[] = [];
    const meshes: THREE.Mesh[] = [];
    const riverWidth = 40; // Must match TerrainChunk.RIVER_WIDTH
    const halfWidth = riverWidth / 2;

    // Calculate positions including ghost vertices
    const zPrev = zStart - this.collisionStep;
    const zNext = zEnd + this.collisionStep;

    const offPrev = this.getRiverOffset(zPrev);
    const offStart = this.getRiverOffset(zStart);
    const offEnd = this.getRiverOffset(zEnd);
    const offNext = this.getRiverOffset(zNext);

    // Left Bank
    const pPrevL = planck.Vec2(-halfWidth + offPrev, zPrev);
    const pStartL = planck.Vec2(-halfWidth + offStart, zStart);
    const pEndL = planck.Vec2(-halfWidth + offEnd, zEnd);
    const pNextL = planck.Vec2(-halfWidth + offNext, zNext);

    const bodyL = this.physicsEngine.world.createBody({ type: 'static' });
    const shapeL = planck.Edge(pStartL, pEndL);
    shapeL.setPrevVertex(pPrevL);
    shapeL.setNextVertex(pNextL);

    bodyL.createFixture({
      shape: shapeL,
      friction: 0.0,
      restitution: 0.0
    });
    bodies.push(bodyL);
    meshes.push(this.createDebugLine(pStartL, pEndL));

    // Right Bank
    const pPrevR = planck.Vec2(halfWidth + offPrev, zPrev);
    const pStartR = planck.Vec2(halfWidth + offStart, zStart);
    const pEndR = planck.Vec2(halfWidth + offEnd, zEnd);
    const pNextR = planck.Vec2(halfWidth + offNext, zNext);

    const bodyR = this.physicsEngine.world.createBody({ type: 'static' });
    const shapeR = planck.Edge(pStartR, pEndR);
    shapeR.setPrevVertex(pPrevR);
    shapeR.setNextVertex(pNextR);

    bodyR.createFixture({
      shape: shapeR,
      friction: 0.0,
      restitution: 0.0
    });
    bodies.push(bodyR);
    meshes.push(this.createDebugLine(pStartR, pEndR));

    return { bodies, meshes };
  }

  private createDebugLine(p1: planck.Vec2, p2: planck.Vec2): THREE.Mesh {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const geometry = new THREE.BoxGeometry(length, 5, 0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(midX, 2.5, midY);
    mesh.rotation.y = -angle;

    return mesh;
  }

  // Getter for chunkSize to fix the typo above
  get chunksSize() {
    return this.chunkSize;
  }
}
