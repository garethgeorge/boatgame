import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';
import { MonkeySpawner } from '../../entities/spawners/MonkeySpawner';
import { Decorations, LSystemTreeKind } from '../Decorations';

export class TestBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'test';

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x88 / 255, g: 0x88 / 255, b: 0x88 / 255 };
    }

    public getAmplitudeMultiplier(): number {
        return 0.0;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        for (let i = 0; i < 60; ++i) {
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position, 0.0)) continue;

            const variation = Math.random();
            const kinds: LSystemTreeKind[] = ['willow', 'poplar', 'oak', 'elm',
                'umbrella', 'open', 'irregular', 'vase'];
            // const kind = kinds[i % kinds.length];
            const kind = 'willow';
            const treeInstances = Decorations.getLSystemTreeInstance(kind, variation);
            context.decoHelper.addInstancedDecoration(context, treeInstances, position);
        }
    }

    private spawner = new MonkeySpawner();

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        //await this.bottleSpawner.spawn(context, 4, zStart, zEnd);
        //await this.spawner.spawn(context, 2, zStart, zEnd);
    }
}
