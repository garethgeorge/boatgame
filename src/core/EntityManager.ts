import { Entity } from './Entity';
import { PhysicsEngine } from './PhysicsEngine';
import { GraphicsEngine } from './GraphicsEngine';
import { Alligator } from '../entities/Obstacles';
import * as planck from 'planck';

export class EntityManager {
  entities: Set<Entity> = new Set();
  physicsEngine: PhysicsEngine;
  graphicsEngine: GraphicsEngine;

  constructor(physicsEngine: PhysicsEngine, graphicsEngine: GraphicsEngine) {
    this.physicsEngine = physicsEngine;
    this.graphicsEngine = graphicsEngine;
  }

  add(entity: Entity) {
    this.entities.add(entity);
    // Planck bodies are added to world upon creation, so no need to add here.
    if (entity.mesh) {
      this.graphicsEngine.add(entity.mesh);
    }
  }

  remove(entity: Entity) {
    if (this.entities.has(entity)) {
      this.entities.delete(entity);
      if (entity.physicsBody) {
        this.physicsEngine.world.destroyBody(entity.physicsBody);
      }
      if (entity.mesh) {
        this.graphicsEngine.remove(entity.mesh);
      }
    }
  }

  update(dt: number) {
    // Find player first (optimization: cache it?)
    let playerPos: planck.Vec2 | null = null;
    for (const entity of this.entities) {
      if (entity.physicsBody && entity.physicsBody.getUserData()) {
        const userData = entity.physicsBody.getUserData() as any;
        if (userData.type === 'player') {
          playerPos = entity.physicsBody.getPosition();
          break;
        }
      }
    }

    // Convert Set to Array to allow reverse iteration and safe removal
    const entitiesArray = Array.from(this.entities);
    for (let i = entitiesArray.length - 1; i >= 0; i--) {
      const entity = entitiesArray[i];
      entity.update(dt);

      // Update AI if applicable
      if (playerPos && entity instanceof Alligator) {
        entity.setTarget(playerPos);
      }

      entity.sync();

      if (entity.shouldRemove) {
        this.remove(entity);
      }
    }
  }
}
