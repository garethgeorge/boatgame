import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { Decorations } from '../Decorations';
import { GraphicsUtils } from '../../core/GraphicsUtils';
import { TRexSpawner } from '../../entities/spawners/TRexSpawner';
import { PterodactylSpawner } from '../../entities/spawners/PterodactylSpawner';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        // for (let i = 0; i < 0; ++i) {
        //     const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
        //     const cycad = Decorations.getTreeFern();
        //     context.decoHelper.positionAndCollectGeometry(cycad, position, context);
        //     GraphicsUtils.disposeObject(cycad);
        // }
    }

    private trexSpawner = new TRexSpawner();
    private pteroSpawner = new PterodactylSpawner();

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        //const count = (zEnd - zStart) * 0.01;
        //await this.trexSpawner.spawn(context, 5, zStart, zEnd);
        await this.pteroSpawner.spawn(context, 2, zStart, zEnd);
    }
}
