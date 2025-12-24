import { Entity } from './Entity';
import { PhysicsEngine } from './PhysicsEngine';
import { GraphicsEngine } from './GraphicsEngine';
import * as planck from 'planck';

export class EntityManager {
  entities: Set<Entity> = new Set();
  physicsEngine: PhysicsEngine;
  graphicsEngine: GraphicsEngine;

  debugMode: boolean = false;

  private chunkEntities: Map<number, Set<Entity>> = new Map();
  private entityToChunk: Map<Entity, number> = new Map();

  constructor(physicsEngine: PhysicsEngine, graphicsEngine: GraphicsEngine) {
    this.physicsEngine = physicsEngine;
    this.graphicsEngine = graphicsEngine;
  }

  setDebug(enabled: boolean) {
    if (this.debugMode === enabled) return;
    this.debugMode = enabled;
    for (const entity of this.entities) {
      const debugMeshes = entity.ensureDebugMeshes();
      for (const debugMesh of debugMeshes) {
        if (this.debugMode) {
          this.graphicsEngine.add(debugMesh);
        } else {
          this.graphicsEngine.remove(debugMesh);
        }
      }
    }
  }

  // Note: only pass null for entities that should never be
  // removed from the scene.
  add(entity: Entity, chunkId: number | null) {
    this.entities.add(entity);

    if (chunkId !== null) {
      if (!this.chunkEntities.has(chunkId)) {
        this.chunkEntities.set(chunkId, new Set());
      }
      this.chunkEntities.get(chunkId)!.add(entity);
      this.entityToChunk.set(entity, chunkId);
    }

    // Planck bodies are added to world upon creation, so no need to add here.
    for (const mesh of entity.meshes) {
      this.graphicsEngine.add(mesh);
    }

    if (this.debugMode) {
      const debugMeshes = entity.ensureDebugMeshes();
      for (const debugMesh of debugMeshes) {
        this.graphicsEngine.add(debugMesh);
      }
    }
  }

  remove(entity: Entity) {
    if (this.entities.has(entity)) {
      this.entities.delete(entity);

      // Remove from chunk tracking
      if (this.entityToChunk.has(entity)) {
        const chunkId = this.entityToChunk.get(entity)!;
        const chunkSet = this.chunkEntities.get(chunkId);
        if (chunkSet) {
          chunkSet.delete(entity);
          if (chunkSet.size === 0) {
            this.chunkEntities.delete(chunkId);
          }
        }
        this.entityToChunk.delete(entity);
      }

      for (const body of entity.physicsBodies) {
        this.physicsEngine.world.destroyBody(body);
      }

      for (const mesh of entity.meshes) {
        this.graphicsEngine.remove(mesh);
      }

      for (const debugMesh of entity.debugMeshes) {
        this.graphicsEngine.remove(debugMesh);
      }

      entity.dispose();
    }
  }

  removeChunk(chunkId: number) {
    const chunkSet = this.chunkEntities.get(chunkId);
    if (chunkSet) {
      // Create a copy to iterate safely while removing
      const entitiesToRemove = Array.from(chunkSet);
      for (const entity of entitiesToRemove) {
        this.remove(entity);
      }
      this.chunkEntities.delete(chunkId);
    }
  }

  savePreviousState() {
    for (const entity of this.entities) {
      entity.savePreviousState();
    }
  }

  update(dt: number) {
    const alpha = this.physicsEngine.getAlpha();

    // Convert Set to Array to allow reverse iteration and safe removal
    const entitiesArray = Array.from(this.entities);
    for (let i = entitiesArray.length - 1; i >= 0; i--) {
      const entity = entitiesArray[i];
      entity.update(dt);

      entity.sync(alpha);

      if (entity.shouldRemove) {
        this.remove(entity);
      }
    }
  }
}
