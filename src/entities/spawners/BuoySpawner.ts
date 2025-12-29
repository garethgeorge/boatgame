import * as planck from 'planck';
import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Buoy } from '../../entities/obstacles/Buoy';
import { Entity } from '../../core/Entity';
import { RiverSystem } from '../../world/RiverSystem';

export class BuoySpawner extends BaseSpawner {
  id = 'buoy';

  protected getDensity(difficulty: number, zStart: number): number {
    const dist = Math.abs(zStart);
    if (dist < 500) return 0;

    const ramp = Math.max(0, (difficulty - 0.06) / 0.94);
    return 0.0053 * ramp;
  }

  async spawnAt(context: SpawnContext, wz: number): Promise<boolean> {
    const riverSystem = RiverSystem.getInstance();

    const isLeft = Math.random() > 0.5;
    const riverWidth = riverSystem.getRiverWidth(wz);
    const riverCenter = riverSystem.getRiverCenter(wz);
    const bankX = riverCenter + (isLeft ? -riverWidth / 2 : riverWidth / 2);
    const direction = isLeft ? 1 : -1;
    const chainLength = (0.3 + Math.random() * 0.2) * riverWidth; // 30-50% width
    const spacing = 4.0;
    const buoyCount = Math.floor(chainLength / spacing);

    if (buoyCount <= 0) return false;

    const anchorBody = context.physicsEngine.world.createBody({
      type: 'static',
      position: planck.Vec2(bankX, wz)
    });

    // Anchor Entity (Hidden)
    class AnchorEntity extends Entity {
      constructor(body: planck.Body) {
        super();
        this.physicsBodies.push(body);
      }
      update(dt: number) { }
      wasHitByPlayer() { }
    }
    const anchorEntity = new AnchorEntity(anchorBody);
    context.entityManager.add(anchorEntity);

    let prevBody = anchorBody;
    for (let j = 1; j <= buoyCount; j++) {
      const dist = j * spacing;
      const bx = bankX + direction * dist;
      const jitterZ = (Math.random() - 0.5) * 1.0;

      // Register placement
      context.placementHelper.registerPlacement(bx, wz + jitterZ, 1.0);

      const buoy = new Buoy(bx, wz + jitterZ, context.physicsEngine);
      context.entityManager.add(buoy);

      const joint = planck.DistanceJoint({
        frequencyHz: 2.0,
        dampingRatio: 0.5,
        collideConnected: false
      }, prevBody, buoy.physicsBodies[0], prevBody.getPosition(), buoy.physicsBodies[0].getPosition());
      context.physicsEngine.world.createJoint(joint);
      prevBody = buoy.physicsBodies[0];
    }
    return true;
  }
}
