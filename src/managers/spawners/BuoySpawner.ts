import * as planck from 'planck';
import { Spawnable, SpawnContext, BiomeWeights } from '../Spawnable';
import { Buoy } from '../../entities/obstacles/Buoy';
import { Entity } from '../../core/Entity';
import { RiverSystem } from '../../world/RiverSystem';

export class BuoySpawner implements Spawnable {
  id = 'buoy';

  getSpawnCount(context: SpawnContext, biomeWeights: BiomeWeights, difficulty: number, chunkLength: number): number {
    // No buoys in ice
    if (biomeWeights.ice > 0.5) return 0;

    // Start at 500m
    const dist = Math.abs(context.zStart);
    if (dist < 500) return 0;

    // Ramp: 0% -> 8% (0.08 per 15m)
    // 0.08 per 15m = 0.0053 per meter
    // Ramp factor: (difficulty - 0.06) / (1 - 0.06)
    const ramp = Math.max(0, (difficulty - 0.06) / 0.94);
    const baseDensity = 0.0053 * ramp;

    const count = chunkLength * baseDensity;

    return Math.floor(count + Math.random());
  }

  async spawn(context: SpawnContext, count: number, biomeWeights: BiomeWeights): Promise<void> {
    const riverSystem = RiverSystem.getInstance();

    for (let i = 0; i < count; i++) {
      // Chained Buoys logic
      const z = context.zStart + Math.random() * (context.zEnd - context.zStart);

      const isLeft = Math.random() > 0.5;
      const riverWidth = riverSystem.getRiverWidth(z);
      const riverCenter = riverSystem.getRiverCenter(z);
      const bankX = riverCenter + (isLeft ? -riverWidth / 2 : riverWidth / 2);
      const direction = isLeft ? 1 : -1;
      const chainLength = (0.3 + Math.random() * 0.2) * riverWidth; // 30-50% width
      const spacing = 4.0;
      const buoyCount = Math.floor(chainLength / spacing);

      const anchorBody = context.physicsEngine.world.createBody({
        type: 'static',
        position: planck.Vec2(bankX, z)
      });

      // Anchor Entity (Hidden)
      class AnchorEntity extends Entity {
        constructor(body: planck.Body) {
          super();
          this.physicsBodies.push(body);
        }
        update(dt: number) { }
        onHit() { }
      }
      const anchorEntity = new AnchorEntity(anchorBody);
      context.entityManager.add(anchorEntity, context.chunkIndex);

      let prevBody = anchorBody;
      for (let j = 1; j <= buoyCount; j++) {
        const dist = j * spacing;
        const bx = bankX + direction * dist;
        const jitterZ = (Math.random() - 0.5) * 1.0;

        // Register placement
        context.placementHelper.registerPlacement(bx, z + jitterZ, 1.0);

        const buoy = new Buoy(bx, z + jitterZ, context.physicsEngine);
        context.entityManager.add(buoy, context.chunkIndex);

        const joint = planck.DistanceJoint({
          frequencyHz: 2.0,
          dampingRatio: 0.5,
          collideConnected: false
        }, prevBody, buoy.physicsBodies[0], prevBody.getPosition(), buoy.physicsBodies[0].getPosition());
        context.physicsEngine.world.createJoint(joint);
        prevBody = buoy.physicsBodies[0];
      }
    }
  }
}
