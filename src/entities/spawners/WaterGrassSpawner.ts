import { SpawnContext } from '../SpawnContext';
import { WaterGrass } from '../../entities/obstacles/WaterGrass';

export class WaterGrassSpawner {
    id = 'water_grass';

    public static *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
        const promise = WaterGrass.preload();
        if (promise) yield promise;
    }

    public static createEntity(
        context: SpawnContext,
        x: number, z: number, width: number, length: number,
        tangent: { x: number, z: number }
    ) {
        const rotation = Math.atan2(tangent.z, tangent.x) - Math.PI / 2;
        const grass = new WaterGrass(x, z, width, length, rotation, context.physicsEngine);
        context.entityManager.add(grass);
    }
}
