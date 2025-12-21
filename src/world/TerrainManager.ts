import { PhysicsEngine, CollisionCategories } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { TerrainChunk } from './TerrainChunk';
import { RiverSystem } from './RiverSystem';
import { ObstacleManager } from '../managers/ObstacleManager';
import { Boat } from '../entities/Boat';

import { Mesh, Vector3, Color3, StandardMaterial, VertexData, TransformNode, Vector2, MeshBuilder } from '@babylonjs/core';
import * as planck from 'planck';

export class TerrainManager {
  private chunks: Map<number, TerrainChunk> = new Map();
  private loadingChunks: Set<number> = new Set();

  private riverSystem: RiverSystem;

  private readonly collisionRadius = 150; // Radius around boat to generate collision
  private readonly collisionStep = 2.5; // Step size for collision segments (Matches TerrainChunk resolution)

  constructor(
    private physicsEngine: PhysicsEngine,
    private graphicsEngine: GraphicsEngine,
    private obstacleManager: ObstacleManager
  ) {
    this.riverSystem = RiverSystem.getInstance();
  }

  private boatHistory: Vector3[] = [];

  update(boat: any, dt: number) {
    // Update all chunks (e.g. for animations)
    for (const chunk of this.chunks.values()) {
      chunk.update(dt);
    }

    if (!boat.meshes || boat.meshes.length === 0) return;

    const boatMesh = boat.meshes[0];
    const boatZ = boatMesh.position.z;
    const currentPos = boatMesh.position.clone();

    // Update History
    if (this.boatHistory.length === 0) {
      this.boatHistory.push(currentPos);
    } else {
      const lastPos = this.boatHistory[0];
      const dist = Vector3.Distance(currentPos, lastPos);
      if (dist > 2.0) { // Only record if moved enough
        this.boatHistory.unshift(currentPos);
        if (this.boatHistory.length > 8) {
          this.boatHistory.pop();
        }
      }
    }

    // Update Water Shader Uniforms
    if (TerrainChunk.waterMaterial) {
      TerrainChunk.waterMaterial.setVector3("uBoatPosition", boatMesh.position);

      // Velocity needs to be calculated or retrieved from physics body
      if (boat.physicsBodies && boat.physicsBodies.length > 0) {
        const vel = boat.physicsBodies[0].getLinearVelocity();
        // Physics Y is World Z
        TerrainChunk.waterMaterial.setVector2("uBoatVelocity", new Vector2(vel.x, vel.y));
      }

      // Direction from rotation
      if (boatMesh.rotationQuaternion) {
        // Compute forward from quaternion
        const forward = new Vector3(0, 0, 1);
        forward.rotateByQuaternionToRef(boatMesh.rotationQuaternion, forward);
        // Project to 2D
        TerrainChunk.waterMaterial.setVector2("uBoatDirection", new Vector2(forward.x, forward.z));
      } else {
        // Euler rotation
        const rot = boatMesh.rotation.y;
        // Rotation Y: 0 = -Z (Forward in 3D?) -> in 2D shader, we might need consistent mapping.
        // Let's stick to the previous logic: -sin, -cos
        TerrainChunk.waterMaterial.setVector2("uBoatDirection", new Vector2(-Math.sin(rot), -Math.cos(rot)));
      }

      // Update History Uniform
      const flatHistory: number[] = [];
      for (let i = 0; i < 8; i++) {
        if (i < this.boatHistory.length) {
          flatHistory.push(this.boatHistory[i].x, this.boatHistory[i].y, this.boatHistory[i].z);
        } else {
          if (this.boatHistory.length > 0) {
            const last = this.boatHistory[this.boatHistory.length - 1];
            flatHistory.push(last.x, last.y, last.z);
          } else {
            flatHistory.push(0, 0, 0);
          }
        }
      }
      TerrainChunk.waterMaterial.setArray3("uBoatHistory", flatHistory);
    }

    // 1. Manage Visual Chunks
    const currentChunkIndex = Math.floor(boatZ / TerrainChunk.CHUNK_SIZE);
    const renderDistance = 6; // Number of chunks to render in each direction

    // Create new chunks
    for (let i = -renderDistance; i <= renderDistance; i++) {
      const index = currentChunkIndex + i;
      if (!this.chunks.has(index) && !this.loadingChunks.has(index)) {
        const zOffset = index * TerrainChunk.CHUNK_SIZE;
        this.loadingChunks.add(index);

        TerrainChunk.createAsync(zOffset, this.graphicsEngine).then(chunk => {
          this.chunks.set(index, chunk);
          this.loadingChunks.delete(index);

          // Spawn obstacles for this chunk
          this.obstacleManager.spawnObstaclesForChunk(index, zOffset, zOffset + TerrainChunk.CHUNK_SIZE);
          // console.log(`[TerrainManager] Created chunk ${index}`);
        });
      }
    }

    // Remove old chunks
    for (const [index, chunk] of this.chunks) {
      if (Math.abs(index - currentChunkIndex) > renderDistance) {
        // console.log(`[TerrainManager] Disposing chunk ${index}`);
        chunk.dispose();
        this.chunks.delete(index);

        // Remove obstacles for this chunk
        this.obstacleManager.removeObstaclesForChunk(index);
      }
    }

    // 2. Manage Collision Segments
    this.updateCollision(boatZ);
  }

  private debug: boolean = false;

  private collisionCache: Map<number, { bodies: planck.Body[], meshes: Mesh[] }> = new Map();

  setDebug(enabled: boolean) {
    if (this.debug === enabled) return;
    this.debug = enabled;
    for (const segment of this.collisionCache.values()) {
      segment.meshes.forEach(mesh => {
        mesh.isVisible = this.debug;
      });
    }
  }

  private updateCollision(boatZ: number) {
    // Generate collision segments around the boat
    const startZ = Math.floor((boatZ - this.collisionRadius) / this.collisionStep) * this.collisionStep;
    const endZ = Math.ceil((boatZ + this.collisionRadius) / this.collisionStep) * this.collisionStep;

    const neededKeys = new Set<number>();
    for (let z = startZ; z < endZ; z += this.collisionStep) {
      neededKeys.add(z);
      if (!this.collisionCache.has(z)) {
        const segment = this.createCollisionSegment(z, z + this.collisionStep);
        segment.meshes.forEach(m => {
          m.isVisible = this.debug;
        });
        this.collisionCache.set(z, segment);
      }
    }

    // Cleanup segments that are out of range
    for (const [z, segment] of this.collisionCache) {
      if (!neededKeys.has(z)) {
        segment.bodies.forEach(b => this.physicsEngine.world.destroyBody(b));
        segment.meshes.forEach(m => m.dispose());
        this.collisionCache.delete(z);
      }
    }
  }

  private createCollisionSegment(zStart: number, zEnd: number): { bodies: planck.Body[], meshes: Mesh[] } {
    const bodies: planck.Body[] = [];
    const meshes: Mesh[] = [];

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
      restitution: 0.0,
      filterCategoryBits: CollisionCategories.TERRAIN,
      filterMaskBits: 0xFFFF
    });
    bodies.push(bodyR);
    meshes.push(this.createDebugLine(pStartR, pEndR));

    return { bodies, meshes };
  }

  private createDebugLine(p1: planck.Vec2, p2: planck.Vec2): Mesh {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    const mesh = MeshBuilder.CreateBox("debug_collision", {
      width: length,
      height: 5,
      depth: 0.5
    }, this.graphicsEngine.scene);

    // Create red wireframe material
    const material = new StandardMaterial("debug_mat", this.graphicsEngine.scene);
    material.diffuseColor = Color3.Red();
    material.wireframe = true;
    mesh.material = material;

    // Physics 2D Y is World Z in game logic
    mesh.position.set(midX, 2.5, midY);

    // Rotation: Planck Y is up? 
    // Wait, in previous ThreeJS: mesh.rotation.y = -angle;
    // Babylon Y rotation is also vertical axis.
    // Angles should be similar if coordinate system matches.

    mesh.rotation.y = -angle;

    return mesh;
  }
}
