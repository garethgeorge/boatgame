import * as THREE from 'three';
import * as planck from 'planck';

import { PhysicsEngine, CollisionCategories } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { TerrainChunk } from './TerrainChunk';
import { RiverSystem } from './RiverSystem';
import { ObstacleManager } from '../managers/ObstacleManager';

import { Boat } from '../entities/Boat';
import { GraphicsUtils } from '../core/GraphicsUtils';

export class TerrainManager {
  private chunks: Map<number, TerrainChunk> = new Map();
  private loadingChunks: Set<number> = new Set();
  private collisionBodies: planck.Body[] = [];
  private collisionMeshes: THREE.Mesh[] = [];

  private riverSystem: RiverSystem;

  private readonly collisionRadius = 300; // Radius around boat to generate collision
  private readonly collisionStep = 5; // Step size for collision segments
  private readonly collisionUpdate = this.collisionStep * 10; // Step for updating segments
  private collisionStartZ: number = -Infinity; // Current start position of generating segments

  constructor(
    private physicsEngine: PhysicsEngine,
    private graphicsEngine: GraphicsEngine,
    private obstacleManager: ObstacleManager
  ) {
    this.riverSystem = RiverSystem.getInstance();
  }

  private boatHistory: THREE.Vector3[] = [];

  update(boat: Boat, dt: number) {
    // Update all chunks (e.g. for animations)
    for (const chunk of this.chunks.values()) {
      chunk.update(dt);
    }

    const boatZ = boat.meshes[0].position.z;
    const currentPos = boat.meshes[0].position.clone();

    // Update History
    if (this.boatHistory.length === 0) {
      this.boatHistory.push(currentPos);
    } else {
      const lastPos = this.boatHistory[0];
      const dist = currentPos.distanceTo(lastPos);
      if (dist > 2.0) { // Only record if moved enough
        this.boatHistory.unshift(currentPos);
        if (this.boatHistory.length > 8) {
          this.boatHistory.pop();
        }
      }
    }

    // Update Water Shader Uniforms
    if (TerrainChunk.waterMaterial) {
      TerrainChunk.waterMaterial.uniforms.uBoatPosition.value.copy(boat.meshes[0].position);

      // Velocity needs to be calculated or retrieved from physics body
      // Boat has getVelocity() or we can use physics body directly
      if (boat.physicsBodies.length > 0) {
        const vel = boat.physicsBodies[0].getLinearVelocity();
        TerrainChunk.waterMaterial.uniforms.uBoatVelocity.value.set(vel.x, vel.y); // Physics Y is World Z

        // Direction from rotation
        const rot = boat.meshes[0].rotation.y;
        // Boat faces -Z at rotation 0?
        // Rotation Y: 0 = -Z, PI/2 = -X, PI = +Z, -PI/2 = +X
        // Direction vector: (-sin(rot), -cos(rot))
        TerrainChunk.waterMaterial.uniforms.uBoatDirection.value.set(-Math.sin(rot), -Math.cos(rot));
      }

      // Update History Uniform
      for (let i = 0; i < 8; i++) {
        if (i < this.boatHistory.length) {
          TerrainChunk.waterMaterial.uniforms.uBoatHistory.value[i].copy(this.boatHistory[i]);
        } else {
          // Fill remaining with last known or zero?
          // Zero might be interpreted as valid position (0,0,0).
          // Let's use the last valid position or zero if empty.
          // Or just leave it, shader checks for length(histPos) < 0.1
          // But (0,0,0) is valid world pos.
          // Let's copy the oldest point to fill.
          if (this.boatHistory.length > 0) {
            TerrainChunk.waterMaterial.uniforms.uBoatHistory.value[i].copy(this.boatHistory[this.boatHistory.length - 1]);
          } else {
            TerrainChunk.waterMaterial.uniforms.uBoatHistory.value[i].set(0, 0, 0);
          }
        }
      }
    }

    // 1. Manage Visual Chunks
    const currentChunkIndex = Math.floor(boatZ / TerrainChunk.CHUNK_SIZE);
    const renderDistance = 6; // Number of chunks to render in each direction

    // Create new chunks
    for (let i = 0; i <= 2 * renderDistance; i++) {

      // limit number of concurrent creations
      if (this.loadingChunks.size > 3)
        break;

      // 0, 1, 2, ... -> 0, -1, 1, -2, ...
      const offset = i % 2 === 0 ? i / 2 : -((i + 1) / 2);
      const index = currentChunkIndex + offset;
      if (!this.chunks.has(index) && !this.loadingChunks.has(index)) {
        const zOffset = index * TerrainChunk.CHUNK_SIZE;
        this.loadingChunks.add(index);

        console.log(`[TerrainManager] Creating chunk ${index}`);
        TerrainChunk.createAsync(zOffset, this.graphicsEngine).then(chunk => {
          this.chunks.set(index, chunk);
          this.loadingChunks.delete(index);

          // Spawn obstacles for this chunk
          this.obstacleManager.spawnObstaclesForChunk(index, zOffset, zOffset + TerrainChunk.CHUNK_SIZE);
          console.log(`[TerrainManager] Created chunk ${index}`);
        });
      }
    }

    // Remove old chunks, slightly wider aperture else chunks can be
    // created and immediately destroyed if the boat is sitting close
    // to a boundary
    for (const [index, chunk] of this.chunks) {
      if (Math.abs(index - currentChunkIndex) > renderDistance + 1) {
        console.log(`[TerrainManager] Disposing chunk ${index}`);
        chunk.dispose();
        this.chunks.delete(index);

        // Calculate the range to remove. The range should extend to the boundaries
        // of the nearest existing chunks.
        // Find nearest existing indices
        const existingIndices = Array.from(this.chunks.keys()).sort((a, b) => a - b);
        const lowerIdx = existingIndices.slice().reverse().find(i => i < index);
        const upperIdx = existingIndices.find(i => i > index);

        let zMin = 0;
        if (lowerIdx !== undefined) {
          zMin = (lowerIdx + 1) * TerrainChunk.CHUNK_SIZE;
        } else {
          zMin = index * TerrainChunk.CHUNK_SIZE - 1000; // Far enough
        }

        let zMax = 0;
        if (upperIdx !== undefined) {
          zMax = upperIdx * TerrainChunk.CHUNK_SIZE;
        } else {
          zMax = (index + 1) * TerrainChunk.CHUNK_SIZE + 1000; // Far enough
        }

        this.obstacleManager.removeInRange(zMin, zMax);
      }
    }

    // 2. Manage Collision Segments
    this.updateCollision(boatZ);
  }

  private debug: boolean = false;

  setDebug(enabled: boolean) {
    if (this.debug === enabled) return;
    this.debug = enabled;

    // collision meshes will update when next generated
    if (!this.debug) {
      // Clear debug meshes immediately
      this.collisionMeshes.forEach(mesh => {
        this.graphicsEngine.remove(mesh);
        GraphicsUtils.disposeObject(mesh);
      });
      this.collisionMeshes = [];
    }
  }

  private updateCollision(boatZ: number) {
    // Generate collision segments around the boat
    const startZ = Math.floor((boatZ - this.collisionRadius) / this.collisionUpdate) * this.collisionUpdate;
    const endZ = Math.ceil((boatZ + this.collisionRadius) / this.collisionUpdate) * this.collisionUpdate;

    if (startZ === this.collisionStartZ) return;

    // Clear old collision bodies
    this.collisionBodies.forEach(b => this.physicsEngine.world.destroyBody(b));
    this.collisionBodies = [];

    // Clear debug meshes
    this.collisionMeshes.forEach(m => {
      this.graphicsEngine.remove(m);
      GraphicsUtils.disposeObject(m);
    });
    this.collisionMeshes = [];

    // Generate new segments
    for (let z = startZ; z < endZ; z += this.collisionStep) {
      const segment = this.createCollisionSegment(z, z + this.collisionStep, this.debug);
      this.collisionBodies.push(...segment.bodies);
      if (segment.meshes) {
        this.collisionMeshes.push(...segment.meshes);
        segment.meshes.forEach(m => {
          this.graphicsEngine.add(m);
        });
      }
    }
  }

  private createCollisionSegment(zStart: number, zEnd: number, createMeshes: boolean): { bodies: planck.Body[], meshes?: THREE.Mesh[] } {
    const bodies: planck.Body[] = [];
    const meshes: THREE.Mesh[] = createMeshes ? [] : null as any;

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
      restitution: 0.0,
      filterCategoryBits: CollisionCategories.TERRAIN,
      filterMaskBits: 0xFFFF
    });
    bodies.push(bodyL);
    if (createMeshes) meshes.push(this.createDebugLine(pStartL, pEndL));

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
      restitution: 0.0,
      filterCategoryBits: CollisionCategories.TERRAIN,
      filterMaskBits: 0xFFFF
    });
    bodies.push(bodyR);
    if (createMeshes) meshes.push(this.createDebugLine(pStartR, pEndR));

    return { bodies, meshes: createMeshes ? meshes : undefined };
  }

  private createDebugLine(p1: planck.Vec2, p2: planck.Vec2): THREE.Mesh {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const geometry = new THREE.BoxGeometry(length, 5, 0.5);
    geometry.name = 'TerrainManager - debug line';

    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    material.name = 'TerrainManager - debug line';

    const mesh = GraphicsUtils.createMesh(geometry, material, 'TerrainCollisionDebug');

    mesh.position.set(midX, 2.5, midY);
    mesh.rotation.y = -angle;
    mesh.visible = this.debug; // Ensure created mesh respects debug state

    return mesh;
  }
}
