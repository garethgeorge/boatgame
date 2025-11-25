import Matter from 'matter-js';

export class PhysicsEngine {
  engine: Matter.Engine;
  runner: Matter.Runner;

  constructor() {
    this.engine = Matter.Engine.create();

    // Disable gravity for top-down view
    this.engine.gravity.y = 0;
    this.engine.gravity.x = 0;
    this.engine.gravity.scale = 0;

    this.runner = Matter.Runner.create();
  }

  update(dt: number) {
    // Matter.js uses fixed timesteps by default, but we can pass delta time
    // dt is in seconds, Matter.Runner.tick expects milliseconds if used directly,
    // but Engine.update expects milliseconds.
    Matter.Engine.update(this.engine, dt * 1000);
  }

  addBody(body: Matter.Body) {
    Matter.World.add(this.engine.world, body);
  }

  removeBody(body: Matter.Body) {
    Matter.World.remove(this.engine.world, body);
  }
}
