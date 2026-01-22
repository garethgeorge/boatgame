import * as planck from 'planck';
import { BaseSpawner } from './BaseSpawner';
import { SpawnContext } from '../Spawnable';
import { Buoy } from '../../entities/obstacles/Buoy';
import { Entity } from '../../core/Entity';
import { RiverSystem } from '../../world/RiverSystem';
import { RiverGeometrySample } from '../../world/RiverGeometry';

export class BuoySpawner extends BaseSpawner {
  id = 'buoy';

  protected getDensity(difficulty: number, zStart: number): number {
    const dist = Math.abs(zStart);
    if (dist < 500) return 0;

    const ramp = Math.max(0, (difficulty - 0.06) / 0.94);
    return 0.0053 * ramp;
  }

  spawnAt(context: SpawnContext, wz: number): boolean {
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

  spawnInRiverAbsolute(
    context: SpawnContext,
    sample: RiverGeometrySample,
    distanceRange: [number, number]
  ): boolean {
    const spacing = 4.0;

    // Determine which end of the range is closer to a bank to use as the anchor
    const d0DistToBank = Math.abs(sample.bankDist - Math.abs(distanceRange[0]));
    const d1DistToBank = Math.abs(sample.bankDist - Math.abs(distanceRange[1]));

    const [startOffset, endOffset] = d0DistToBank < d1DistToBank ?
      [distanceRange[0], distanceRange[1]] :
      [distanceRange[1], distanceRange[0]];

    const chainLength = Math.abs(endOffset - startOffset);
    const buoyCount = Math.floor(chainLength / spacing);

    if (buoyCount <= 0) return false;

    const direction = Math.sign(endOffset - startOffset);

    // Create anchor
    const startX = sample.centerPos.x + startOffset * sample.normal.x;
    const startZ = sample.centerPos.z + startOffset * sample.normal.z;

    const anchorBody = context.physicsEngine.world.createBody({
      type: 'static',
      position: planck.Vec2(startX, startZ)
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
      const offset = startOffset + direction * dist;
      const jitterAmount = (Math.random() - 0.5) * 1.0;
      const bx = sample.centerPos.x + offset * sample.normal.x + jitterAmount * sample.tangent.x;
      const bz = sample.centerPos.z + offset * sample.normal.z + jitterAmount * sample.tangent.z;

      // Register placement
      context.placementHelper.registerPlacement(bx, bz, 1.0);

      const buoy = new Buoy(bx, bz, context.physicsEngine);
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
