import { Entity } from './Entity';
import { PhysicsEngine } from './PhysicsEngine';
import { GraphicsEngine } from './GraphicsEngine';
import { Alligator } from '../entities/obstacles';
import * as planck from 'planck';

export class EntityManager {
  entities: Set<Entity> = new Set();
  physicsEngine: PhysicsEngine;
  graphicsEngine: GraphicsEngine;

  debugMode: boolean = false;

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

  add(entity: Entity) {
    this.entities.add(entity);
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

  savePreviousState() {
    for (const entity of this.entities) {
      entity.savePreviousState();
    }
  }

  update(dt: number) {
    // Find player first (optimization: cache it?)
    let playerPos: planck.Vec2 | null = null;
    for (const entity of this.entities) {
      // Check first body for player tag
      if (entity.physicsBodies.length > 0) {
        const body = entity.physicsBodies[0];
        if (body.getUserData()) {
          const userData = body.getUserData() as any;
          if (userData.type === 'player') {
            playerPos = body.getPosition();
            break;
          }
        }
      }
    }

    const alpha = this.physicsEngine.getAlpha();

    // Convert Set to Array to allow reverse iteration and safe removal
    const entitiesArray = Array.from(this.entities);
    for (let i = entitiesArray.length - 1; i >= 0; i--) {
      const entity = entitiesArray[i];
      entity.update(dt);

      // Update AI if applicable
      if (playerPos && entity instanceof Alligator) {
        entity.setTarget(playerPos);
      }

      entity.sync(alpha);

      if (entity.shouldRemove) {
        this.remove(entity);
      }
    }
  }
}
