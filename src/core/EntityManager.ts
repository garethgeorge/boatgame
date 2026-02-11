import * as THREE from 'three';
import { Entity } from './Entity';
import { PhysicsEngine } from './PhysicsEngine';
import { GraphicsEngine } from './GraphicsEngine';
import * as planck from 'planck';
import { DesignerSettings } from './DesignerSettings';

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
      if (!this.debugMode) {
        entity.destroyDebugMeshes();
      }
    }
  }

  // Note: only pass null for entities that should never be
  // removed from the scene.
  add(entity: Entity) {
    this.entities.add(entity);

    // Sync immediately so meshes are correctly positioned before being added to the scene
    entity.sync(1.0);

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

      // Optimization: Skip update and sync if entity is not visible
      // Always update player (Boat)
      const isPlayer = entity.physicsBodies.length > 0 &&
        (entity.physicsBodies[0].getUserData() as any)?.type === Entity.TYPE_PLAYER;

      // Order is important. A frame has been rendered and physics has been run
      // so that physics body state corresponds to the next frame. Update and
      // sync together set things up for the next render and physics update.
      // At the end the visuals should be prepared for the next render and
      // physics for updating after that render.
      // There are two basic cases:
      // - Dynamic motion, entity update sets physics parameters to be used on
      //   the next iteration, sync copies the current body position to the
      //   visuals for render.
      // - Kinematic motion, entity update directly sets the visuals, sync
      //   copies this to the physics body.
      if (entity.isVisible || isPlayer || DesignerSettings.isDesignerMode) {
        entity.update(dt);
        entity.sync(alpha);
      }

      if (entity.shouldRemove) {
        this.remove(entity);
      }
    }
  }

  public updateVisibility(cameraPos: THREE.Vector3, cameraDir: THREE.Vector3) {
    if (DesignerSettings.isDesignerMode) return;

    const visibilityRadius = 360;
    const dotBuffer = -20; // Entities are small, smaller buffer than chunks

    for (const entity of this.entities) {
      if (entity.physicsBodies.length === 0) continue;

      // Use physics position instead of mesh position because sync() might be skipped
      const bodyPos = entity.physicsBodies[0].getPosition();
      const entityX = bodyPos.x;
      const entityZ = bodyPos.y; // Physics Y is Graphics Z
      const entityPos = new THREE.Vector3(entityX, 0, entityZ);

      // Distance check
      const dist = cameraPos.distanceTo(entityPos);

      if (dist > visibilityRadius) {
        entity.setVisible(false);
        continue;
      }

      // Tiered Throttling
      if (dist < 50) {
        entity.setAnimationThrottle(1);
      } else if (dist < 100) {
        entity.setAnimationThrottle(3);
      } else {
        entity.setAnimationThrottle(6);
      }

      // Direction check (dot product)
      const toEntity = entityPos.clone().sub(cameraPos);
      const dot = toEntity.dot(cameraDir);

      if (DesignerSettings.isDesignerMode) {
        entity.setVisible(true);
        entity.setAnimationThrottle(1);
      } else {
        if (dot < dotBuffer) {
          entity.setVisible(false);
        } else {
          entity.setVisible(true);
        }
      }
    }
  }

  public getEntityStats(): Map<string, number> {
    const stats = new Map<string, number>();
    for (const entity of this.entities) {
      let type = 'unknown';
      if (entity.physicsBodies.length > 0) {
        const userData = entity.physicsBodies[0].getUserData() as any;
        if (userData) {
          type = userData.subtype || userData.type || 'unknown';
        }
      }

      stats.set(type, (stats.get(type) || 0) + 1);
    }
    return stats;
  }
}
