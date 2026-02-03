import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/SpawnContext';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/DecorationContext';

export class NullBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'null';
    private static readonly LENGTH = 1000;

    constructor(index: number, z: number, direction: number) {
        super(index, z, NullBiomeFeatures.LENGTH, direction);
    }

    getGroundColor(x: number, y: number, z: number): { r: number, g: number, b: number } {
        // Neutral grey
        return { r: 0.5, g: 0.5, b: 0.5 };
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0.5, g: 0.5, b: 0.5 };
    }
    getFogRange(): { near: number, far: number } {
        return { near: 1000, far: 10000 };
    }

    * decorate(context: DecorationContext, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // No decorations
    }

    * spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Generator<void | Promise<void>, void, unknown> {
        // No spawning
    }
}
