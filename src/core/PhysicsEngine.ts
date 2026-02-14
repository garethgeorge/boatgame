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

    public onStep: (() => void) | null = null;

    update(dt: number) {
        // Cap dt to prevent spiral of death if frame rate drops too low
        let frameTime = Math.min(dt, this.MAX_FRAME_TIME);

        this.accumulator += frameTime;

        while (this.accumulator >= this.FIXED_STEP) {
            // Notify before step
            if (this.onStep) this.onStep();

            // Step the world with fixed time step
            this.world.step(this.FIXED_STEP, 10, 8);
            this.accumulator -= this.FIXED_STEP;
        }
    }

    getAlpha(): number {
        return this.accumulator / this.FIXED_STEP;
    }
}


export const CollisionCategories = {
    BOAT: 0x0001,
    ANIMAL: 0x0002,
    TERRAIN: 0x0004,        // i.e. river edge
    OBSTACLE: 0x0008,
    COLLECTABLE: 0x0010,
};
