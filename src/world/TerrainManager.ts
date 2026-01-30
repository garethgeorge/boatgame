import * as THREE from 'three';
import * as planck from 'planck';

import { PhysicsEngine, CollisionCategories } from '../core/PhysicsEngine';
import { GraphicsEngine } from '../core/GraphicsEngine';
import { TerrainChunk } from './TerrainChunk';
import { RiverSystem } from './RiverSystem';

import { Boat } from '../entities/Boat';
import { GraphicsUtils } from '../core/GraphicsUtils';
import { EntityManager } from '../core/EntityManager';
import { DesignerSettings } from '../core/DesignerSettings';

export class TerrainManager {
  private riverSystem: RiverSystem;

  // The active chunks
  private chunks: Map<number, TerrainChunk> = new Map();

  // Chunks that are being loaded
  private loadingChunks: Map<number, {
    chunk: TerrainChunk,
    iterator: Generator<void | Promise<void>, void, unknown>,
    activePromise?: Promise<void>
  }> = new Map();

  // For designer mode, a list of chunk indicies to recreate
  private regenerationQueue: number[] = [];

  // Collision segments along the shoreline
  private collisionBodies: planck.Body[] = [];
  private collisionMeshes: THREE.Mesh[] = [];

  private readonly collisionRadius = 300; // Radius around boat to generate collision
  private readonly collisionStep = 5; // Step size for collision segments
  private readonly collisionUpdate = this.collisionStep * 10; // Step for updating segments
  private collisionStartZ: number = -Infinity; // Current start position of generating segments

  private boatHistory: THREE.Vector3[] = [];


  constructor(
    private physicsEngine: PhysicsEngine,
    private graphicsEngine: GraphicsEngine,
    private entityManager: EntityManager
  ) {
    this.riverSystem = RiverSystem.getInstance();
  }

  public regenerateDesignerTerrain(): void {
    if (!DesignerSettings.isDesignerMode) return;

    console.log('[TerrainManager] Requested designer terrain regeneration');
    this.regenerationQueue = Array.from(this.chunks.keys()).sort((a, b) => b - a);
  }

  /**
   * Processes chunk generation iterators for up to timeMs milliseconds.
   */
  public generate(timeMs: number) {
    const startTime = performance.now();

    for (const [index, entry] of this.loadingChunks) {
      // Check if time is up
      if (performance.now() - startTime >= timeMs) {
        break;
      }

      // If chunk is waiting on a promise, skip it
      if (entry.activePromise) {
        continue;
      }

      const { chunk, iterator } = entry;

      // Step the generator
      const result = iterator.next();

      if (result.value instanceof Promise) {
        // Chunk yielded a promise (e.g., waiting for model load)
        const promise = result.value;
        entry.activePromise = promise;
        promise.finally(() => {
          entry.activePromise = undefined;
        });
      }

      if (result.done) {
        // Chunk is fully initialized
        this.chunks.set(index, chunk);
        this.loadingChunks.delete(index);
        console.log(`[TerrainManager] Finished creating chunk ${index}`);
      }
    }
  }

  update(boat: Boat, dt: number) {
    // Update all chunks (e.g. for animations)
    for (const chunk of this.chunks.values()) {
      chunk.update(dt);
    }

    const boatZ = boat.meshes[0].position.z;
    const currentPos = boat.meshes[0].position.clone();

    // Update Boat History
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

    // Manage Terrain Chunks
    this.manageTerrainChunks(boatZ);

    // Manage Collision Segments
    this.updateCollision(boatZ);
  }

  public updateVisibility(cameraPos: THREE.Vector3, cameraDir: THREE.Vector3) {
    const visibilityRadiusSq = Math.pow(360 + TerrainChunk.CHUNK_SIZE, 2); // Squared radius for efficiency
    const dotBuffer = -20; // Allow slight buffer behind camera plane

    for (const chunk of this.chunks.values()) {
      const z0 = chunk.zOffset;
      const z1 = chunk.zOffset + TerrainChunk.CHUNK_SIZE;

      // Calculate 4 corners of the chunk in world space
      const halfWidth = TerrainChunk.CHUNK_WIDTH / 2;
      const x0 = this.riverSystem.getRiverCenter(z0);
      const x1 = this.riverSystem.getRiverCenter(z1);

      const corners = [
        new THREE.Vector3(x0 - halfWidth, 0, z0),
        new THREE.Vector3(x0 + halfWidth, 0, z0),
        new THREE.Vector3(x1 - halfWidth, 0, z1),
        new THREE.Vector3(x1 + halfWidth, 0, z1)
      ];

      // 1. Distance check (rough culling)
      // Check if any corner is within range, or if camera is within the chunk's Z range
      let inRange = DesignerSettings.isDesignerMode || (cameraPos.z >= z0 && cameraPos.z <= z1);
      if (!inRange) {
        for (const corner of corners) {
          if (cameraPos.distanceToSquared(corner) < visibilityRadiusSq) {
            inRange = true;
            break;
          }
        }
      }

      if (!inRange) {
        chunk.setVisible(false);
        continue;
      }

      // 2. Direction check (frustum-ish culling)
      // Visible if ANY corner is in front of the camera plane, or if camera is inside chunk Z
      let visible = DesignerSettings.isDesignerMode || (cameraPos.z >= z0 && cameraPos.z <= z1);
      if (!visible) {
        for (const corner of corners) {
          const toCorner = corner.clone().sub(cameraPos);
          if (toCorner.dot(cameraDir) > dotBuffer) {
            visible = true;
            break;
          }
        }
      }

      chunk.setVisible(visible);
    }
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

  private manageTerrainChunks(boatZ: number) {

    const renderDistance = 7;
    const currentChunkIndex = Math.floor(boatZ / TerrainChunk.CHUNK_SIZE);

    // Determine range of chunks needed. In designer mode, we use a fixed range
    // to avoid churn if the boat/camera moves
    let negDistance = renderDistance;
    const posDistance = renderDistance;
    let iMinChunk = currentChunkIndex - negDistance;
    let iMaxChunk = currentChunkIndex + posDistance;
    if (DesignerSettings.isDesignerMode) {
      const boundaries = this.riverSystem.biomeManager.getBiomeBoundaries(-1);
      const biomeMinChunkIdx = Math.floor(boundaries.zMin / TerrainChunk.CHUNK_SIZE);
      iMinChunk = biomeMinChunkIdx - 1;
      iMaxChunk = 1;
    }

    // each chunk has range [idx * size, (idx + 1) * size]
    const zMinWindow = iMinChunk * TerrainChunk.CHUNK_SIZE;
    const zMaxWindow = (iMaxChunk + 1) * TerrainChunk.CHUNK_SIZE;

    // Ensure biomes exist for the window
    this.riverSystem.biomeManager.ensureWindow(zMinWindow, zMaxWindow);

    const loadChunk = (index: number) => {
      if (!this.chunks.has(index) && !this.loadingChunks.has(index)) {
        console.log(`[TerrainManager] Starting creation of chunk ${index}`);
        const zOffset = index * TerrainChunk.CHUNK_SIZE;
        const chunk = TerrainChunk.create(zOffset, this.graphicsEngine);
        const iterator = chunk.getInitIterator(this.physicsEngine, this.entityManager);
        this.loadingChunks.set(index, { chunk, iterator });
      }
    };

    // Start loading new chunks. Do so from the boat position out and
    // assuming -ve z traveral
    for (let iChunk = currentChunkIndex;
      iChunk >= iMinChunk && this.loadingChunks.size < 3;
      iChunk--) {
      loadChunk(iChunk);
    }
    for (let iChunk = currentChunkIndex + 1;
      iChunk <= iMaxChunk && this.loadingChunks.size < 3;
      iChunk++) {
      loadChunk(iChunk);
    }

    // Remove old chunks. Those that don't intersect the window + 1 to avoid
    // create/delete cycles when close to chunk boundaries.
    let removeCount = 0;

    // If in designer mode and regenerating explicitly delete chunks and let
    // them get recreated
    let regenerateIndex = Infinity;
    if (DesignerSettings.isDesignerMode && this.regenerationQueue.length > 0) {
      if (this.loadingChunks.size === 0)
        regenerateIndex = this.regenerationQueue.shift()!;
    }

    for (const [index, chunk] of this.chunks) {
      if ((iMinChunk - 1 <= index && index <= iMaxChunk + 1) && index != regenerateIndex)
        continue;

      removeCount += 1;
      console.log(`[TerrainManager] Disposing chunk ${index}`);
      chunk.dispose();
      this.chunks.delete(index);
    }

    // Remove all entities that do not belong to an active chunk.
    if (removeCount > 0) {
      const indices = this.getActiveChunkIndices();
      if (indices.length > 0) {
        // 1. Clear everything significantly before the first chunk
        const firstZ = indices[0] * TerrainChunk.CHUNK_SIZE;
        this.entityManager.removeEntitiesInRange(firstZ - 2000, firstZ);

        // 2. Clear everything significantly after the last chunk
        const lastZ = (indices[indices.length - 1] + 1) * TerrainChunk.CHUNK_SIZE;
        this.entityManager.removeEntitiesInRange(lastZ, lastZ + 2000);

        // 3. Clear gaps between chunks
        for (let i = 0; i < indices.length - 1; i++) {
          const expectedNext = indices[i] + 1;
          if (indices[i + 1] > expectedNext) {
            const gapStart = expectedNext * TerrainChunk.CHUNK_SIZE;
            const gapEnd = indices[i + 1] * TerrainChunk.CHUNK_SIZE;
            this.entityManager.removeEntitiesInRange(gapStart, gapEnd);
          }
        }

        // 4. Prune biomes
        this.riverSystem.biomeManager.pruneWindow(firstZ, lastZ);
      }
    }
  }

  private getActiveChunkIndices(): number[] {
    const indices = new Set<number>();
    for (const index of this.chunks.keys()) indices.add(index);
    for (const index of this.loadingChunks.keys()) indices.add(index);
    return Array.from(indices).sort((a, b) => a - b);
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
    if (!bodyL) {
      console.error('[TerrainManager] Failed to create left collision body - world likely locked');
      return { bodies: [], meshes: createMeshes ? [] : undefined };
    }

    const shapeL = new planck.EdgeShape(pStartL, pEndL);
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
    if (!bodyR) {
      console.error('[TerrainManager] Failed to create right collision body - world likely locked');
      return { bodies, meshes: createMeshes ? meshes : undefined };
    }

    const shapeR = new planck.EdgeShape(pStartR, pEndR);
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

  public getDecorationStats(): Map<string, number> {
    const stats = new Map<string, number>();
    for (const chunk of this.chunks.values()) {
      const chunkStats = chunk.getDecorationStats();
      for (const [species, count] of chunkStats) {
        stats.set(species, (stats.get(species) || 0) + count);
      }
    }
    return stats;
  }
}
