import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { SmallMangrove, LargeMangrove } from '../../entities/obstacles/Mangrove';
import { RiverSystem } from '../../world/RiverSystem';
import { Decorations } from '../../world/Decorations';

export class MangroveSpawner extends BaseSpawner {
  id = 'mangrove';

  constructor(private readonly density: number = 8 / 62) {
    super();
  }

  protected getDensity(difficulty: number, zStart: number): number {
    return this.density;
  }

  *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
  }

  spawnAt(context: SpawnContext, z: number, biomeZRange: [number, number]): boolean {
    const riverSystem = RiverSystem.getInstance();

    // Get river width and center at this Z
    const riverWidth = riverSystem.getRiverWidth(z);
    const riverCenter = riverSystem.getRiverCenter(z);

    // Spawn across full width + 60m overlap on each side (shores)
    const spawnWidth = riverWidth + 60;

    // Retry loop for rejection sampling (bias towards shores)
    let x = 0;
    let valid = false;
    const attempts = 5;

    for (let i = 0; i < attempts; i++) {
      x = riverCenter + (Math.random() - 0.5) * spawnWidth;

      // Rejection Sampling:
      // Identify if we are in the "Center" (inner 50% of river)
      const distFromCenter = Math.abs(x - riverCenter);
      const isCenter = distFromCenter < (riverWidth * 0.25); // Inner 25% radius = 50% diameter

      if (isCenter) {
        // Reject 50% of center spawns to create 2:1 ratio favoring shores
        if (Math.random() < 0.5) {
          continue; // Retry
        }
      }

      // Skip spawning within the middle 20% of the river to create a clear path
      if (distFromCenter < riverWidth * 0.1) {
        continue;
      }

      valid = true;
      break;
    }

    if (!valid) return false;

    // Scale / Type Logic
    // Size Variance
    let baseScale = 1.0;
    const rand = Math.random();
    if (rand < 0.05) {
      baseScale = 2.0;
    } else if (rand < 0.30) {
      baseScale = 1.3;
    }

    // Jitter: +/- 20% (0.8 to 1.2)
    const jitter = 0.8 + Math.random() * 0.4;
    const finalScale = baseScale * jitter;

    if (baseScale > 1.05) {
      const mangrove = new LargeMangrove(x, z, finalScale, context.physicsEngine);
      context.entityManager.add(mangrove);
    } else {
      const mangrove = new SmallMangrove(x, z, finalScale, context.physicsEngine);
      context.entityManager.add(mangrove);
    }

    return true;
  }

  spawnAbsolute(
    context: SpawnContext,
    x: number,
    z: number,
    scaleOverride?: number
  ): boolean {
    // Scale / Type Logic
    // Size Variance
    let baseScale = 1.0;
    if (scaleOverride) {
      baseScale = scaleOverride;
    } else {
      const rand = Math.random();
      if (rand < 0.05) {
        baseScale = 2.0;
      } else if (rand < 0.30) {
        baseScale = 1.3;
      }
    }

    // Jitter: +/- 20% (0.8 to 1.2)
    const jitter = 0.8 + Math.random() * 0.4;
    const finalScale = baseScale * jitter;

    if (baseScale > 1.05) {
      const mangrove = new LargeMangrove(x, z, finalScale, context.physicsEngine);
      context.entityManager.add(mangrove);
    } else {
      const mangrove = new SmallMangrove(x, z, finalScale, context.physicsEngine);
      context.entityManager.add(mangrove);
    }
    return true;
  }
}

