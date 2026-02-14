import * as planck from 'planck';
import { Buoy } from '../../entities/obstacles/Buoy';
import { Entity } from '../Entity';
import { RiverSystem } from '../../world/RiverSystem';
import { PopulationContext } from '../../world/biomes/PopulationContext';
import { RiverGeometrySample } from '../../world/RiverGeometry';

export class BuoySpawner {
    /**
     * Create buoy chain at river sample location running across the river
     * starting at distanceRange[0] and ending at distanceRange[1] relative
     * to the river center
     */
    public static createEntity(
        context: PopulationContext,
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
            updateLogic(dt: number) { }
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
