import * as planck from 'planck';
import { PopulationContext } from '../../world/biomes/PopulationContext';
import { Pier } from '../obstacles/Pier';
import { Decorations } from '../../world/decorations/Decorations';

export class PierSpawner {
    public static createEntity(
        context: PopulationContext,
        x: number, z: number, length: number, angle: number,
        hasDepot: boolean
    ): boolean {

        const pier = new Pier(x, z, length, angle, context.physicsEngine, hasDepot);
        context.entityManager.add(pier);
        return true;
    }
}
