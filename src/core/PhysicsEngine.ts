import * as planck from 'planck';

export class PhysicsEngine {
  world: planck.World;

  constructor() {
    // Create world with no gravity
    this.world = new planck.World(planck.Vec2(0, 0));
  }

  update(dt: number) {
    // Step the world
    // timeStep, velocityIterations, positionIterations
    this.world.step(dt, 10, 10);
  }
}

