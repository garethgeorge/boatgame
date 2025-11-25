import { Entity } from './Entity';
import { PhysicsEngine } from './PhysicsEngine';
import { GraphicsEngine } from './GraphicsEngine';

export class EntityManager {
  entities: Entity[] = [];
  physicsEngine: PhysicsEngine;
  graphicsEngine: GraphicsEngine;

  constructor(physicsEngine: PhysicsEngine, graphicsEngine: GraphicsEngine) {
    this.physicsEngine = physicsEngine;
    this.graphicsEngine = graphicsEngine;
  }

  add(entity: Entity) {
    this.entities.push(entity);
    if (entity.physicsBody) {
      this.physicsEngine.addBody(entity.physicsBody);
    }
    if (entity.mesh) {
      this.graphicsEngine.add(entity.mesh);
    }
  }

  remove(entity: Entity) {
    const index = this.entities.indexOf(entity);
    if (index > -1) {
      this.entities.splice(index, 1);
      if (entity.physicsBody) {
        this.physicsEngine.removeBody(entity.physicsBody);
      }
      if (entity.mesh) {
        this.graphicsEngine.remove(entity.mesh);
      }
    }
  }

  update(dt: number) {
    for (const entity of this.entities) {
      entity.update(dt);
      entity.sync();
    }
  }
}
