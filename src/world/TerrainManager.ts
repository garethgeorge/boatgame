import * as THREE from 'three';
import * as planck from 'planck';

import { PhysicsEngine } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { TerrainChunk } from './TerrainChunk';
import { RiverSystem } from './RiverSystem';

export class TerrainManager {
  private chunks: Map<number, TerrainChunk> = new Map();
  private collisionBodies: planck.Body[] = [];
  private collisionMeshes: THREE.Mesh[] = [];

  private riverSystem: RiverSystem;

  private readonly collisionRadius = 150; // Radius around boat to generate collision
  private readonly collisionStep = 5; // Step size for collision segments

  constructor(
    private physicsEngine: PhysicsEngine,
    private graphicsEngine: GraphicsEngine
  ) {

    this.riverSystem = RiverSystem.getInstance();
  }

  update(boatZ: number) {
    // 1. Manage Visual Chunks
    const currentChunkIndex = Math.floor(boatZ / TerrainChunk.CHUNK_SIZE);
    const renderDistance = 3; // Number of chunks to render in each direction

    // Create new chunks
    for (let i = -renderDistance; i <= renderDistance; i++) {
      const index = currentChunkIndex + i;
      if (!this.chunks.has(index)) {
        const zOffset = index * TerrainChunk.CHUNK_SIZE;
        const chunk = new TerrainChunk(zOffset, this.graphicsEngine);
        this.chunks.set(index, chunk);
      }
    }

    // Remove old chunks
    for (const [index, chunk] of this.chunks) {
      if (Math.abs(index - currentChunkIndex) > renderDistance) {
        chunk.dispose();
        this.chunks.delete(index);
      }
    }

    // 2. Manage Collision Segments
    this.updateCollision(boatZ);
  }

  private updateCollision(boatZ: number) {
    // Generate collision segments around the boat
    const startZ = Math.floor((boatZ - this.collisionRadius) / this.collisionStep) * this.collisionStep;
    const endZ = Math.ceil((boatZ + this.collisionRadius) / this.collisionStep) * this.collisionStep;

    // Clear old collision bodies
    this.collisionBodies.forEach(b => this.physicsEngine.world.destroyBody(b));
    this.collisionBodies = [];

    // Clear debug meshes
    this.collisionMeshes.forEach(m => {
      this.graphicsEngine.remove(m);
      m.geometry.dispose();
      if (Array.isArray(m.material)) {
        m.material.forEach(mat => mat.dispose());
      } else {
        m.material.dispose();
      }
    });
    this.collisionMeshes = [];

    // Generate new segments
    for (let z = startZ; z < endZ; z += this.collisionStep) {
      const segment = this.createCollisionSegment(z, z + this.collisionStep);
      this.collisionBodies.push(...segment.bodies);
      this.collisionMeshes.push(...segment.meshes);
      segment.meshes.forEach(m => this.graphicsEngine.add(m));
    }
  }

  private createCollisionSegment(zStart: number, zEnd: number): { bodies: planck.Body[], meshes: THREE.Mesh[] } {
    const bodies: planck.Body[] = [];
    const meshes: THREE.Mesh[] = [];

    // Calculate positions including ghost vertices
    const zPrev = zStart - this.collisionStep;
    const zNext = zEnd + this.collisionStep;

    // Get river data from RiverSystem
    const centerPrev = this.riverSystem.getRiverCenter(zPrev);
    const centerStart = this.riverSystem.getRiverCenter(zStart);
    const centerEnd = this.riverSystem.getRiverCenter(zEnd);
    const centerNext = this.riverSystem.getRiverCenter(zNext);

    const widthPrev = this.riverSystem.getRiverWidth(zPrev);
    const widthStart = this.riverSystem.getRiverWidth(zStart);
    const widthEnd = this.riverSystem.getRiverWidth(zEnd);
    const widthNext = this.riverSystem.getRiverWidth(zNext);

    // Left Bank
    const pPrevL = planck.Vec2(centerPrev - widthPrev / 2, zPrev);
    const pStartL = planck.Vec2(centerStart - widthStart / 2, zStart);
    const pEndL = planck.Vec2(centerEnd - widthEnd / 2, zEnd);
    const pNextL = planck.Vec2(centerNext - widthNext / 2, zNext);

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
    const pPrevR = planck.Vec2(centerPrev + widthPrev / 2, zPrev);
    const pStartR = planck.Vec2(centerStart + widthStart / 2, zStart);
    const pEndR = planck.Vec2(centerEnd + widthEnd / 2, zEnd);
    const pNextR = planck.Vec2(centerNext + widthNext / 2, zNext);

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
}
