import * as THREE from 'three';
import { PopulationContext } from '../../world/biomes/PopulationContext';
import { LillyPadPatch } from '../obstacles/LillyPadPatch';
import { DecorationId } from '../../world/decorations/Decorations';

export class LillyPadPatchSpawner {

    public static *ensureLoaded(loaded: Set<DecorationId>): Generator<void | Promise<void>, void, unknown> {
        const promise = LillyPadPatch.preload();
        if (promise) yield promise;
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
