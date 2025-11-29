import * as planck from 'planck';

export class PhysicsEngine {
  world: planck.World;

  constructor() {
    // Create world with no gravity
    this.world = new planck.World(planck.Vec2(0, 0));
  }

  private accumulator: number = 0;
  private readonly FIXED_STEP = 1 / 60;
  private readonly MAX_FRAME_TIME = 0.25; // Cap at 250ms to prevent spiral of death

  update(dt: number) {
    // Cap dt to prevent spiral of death if frame rate drops too low
    let frameTime = Math.min(dt, this.MAX_FRAME_TIME);

    this.accumulator += frameTime;

    while (this.accumulator >= this.FIXED_STEP) {
      // Step the world with fixed time step
      this.world.step(this.FIXED_STEP, 10, 8);
      this.accumulator -= this.FIXED_STEP;
    }

    // Clear any remaining small accumulator to prevent drift? 
    // No, keep it for next frame.
  }
}

