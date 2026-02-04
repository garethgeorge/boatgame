import * as THREE from 'three';
import { PopulationContext } from '../../world/biomes/PopulationContext';
import { LillyPadPatch } from '../obstacles/LillyPadPatch';

export class LillyPadPatchSpawner {

    public static *ensureLoaded(): Generator<void | Promise<void>, void, unknown> {
    }
    public static createEntity(
        context: PopulationContext,
        x: number, z: number, width: number, length: number,
        tangent: { x: number, z: number }
    ) {
        const rotation = Math.atan2(tangent.z, tangent.x) - Math.PI / 2;
        const patch = new LillyPadPatch(x, z, width, length, rotation, context.physicsEngine);
        context.entityManager.add(patch);
    }
}
