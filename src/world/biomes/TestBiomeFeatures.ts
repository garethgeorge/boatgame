import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        // No decorations for test biome
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        //const count = (zEnd - zStart) * 0.01;
        //await this.rockSpawner.spawn(context, count, zStart, zEnd);
    }
}
