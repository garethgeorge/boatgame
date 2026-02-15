import * as THREE from 'three';
import { PopulationContext } from '../../world/biomes/PopulationContext';
import { WaterGrass } from '../obstacles/WaterGrass';
import { DecorationId } from '../../world/decorations/Decorations';

export class WaterGrassSpawner {
    id = 'water_grass';

    public static *ensureLoaded(loaded: Set<DecorationId>): Generator<void | Promise<void>, void, unknown> {
        const promise = WaterGrass.preload();
        if (promise) yield promise;
    }

    public static createEntity(
        context: PopulationContext,
        x: number, z: number, width: number, length: number,
        tangent: { x: number, z: number }
    ) {
        const rotation = Math.atan2(tangent.z, tangent.x) - Math.PI / 2;
        const grass = new WaterGrass(x, z, width, length, rotation, context.physicsEngine);
        context.entityManager.add(grass);
    }
}
