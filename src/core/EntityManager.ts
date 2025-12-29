import { Entity } from './Entity';
import { PhysicsEngine } from './PhysicsEngine';
import { GraphicsEngine } from './GraphicsEngine';
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

  // Note: only pass null for entities that should never be
  // removed from the scene.
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

  removeEntitiesInRange(zMin: number, zMax: number) {
    // chunk width is 400 so 10000 should be more than enough
    const aabb = {
      lowerBound: planck.Vec2(-10000, zMin),
      upperBound: planck.Vec2(10000, zMax)
    };

    const entitiesToRemove = new Set<Entity>();
    this.physicsEngine.world.queryAABB(aabb, (fixture) => {
      const body = fixture.getBody();
      const userData = body.getUserData() as any;
      if (userData && userData.entity && userData.type !== 'player') {
        entitiesToRemove.add(userData.entity);
      }
      return true; // continue query
    });

    for (const entity of entitiesToRemove) {
      this.remove(entity);
    }

    console.log('Removed entities:', entitiesToRemove.size, 'current:', this.entities.size);
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
