import * as THREE from 'three';
import { BaseBiomeFeatures } from './BaseBiomeFeatures';
import { SpawnContext } from '../../entities/Spawnable';
import { BiomeType } from './BiomeType';
import { DecorationContext } from '../decorators/TerrainDecorator';
import { MangroveSpawner } from '../../entities/spawners/MangroveSpawner';
import { Decorations } from '../Decorations';
import { LogSpawner } from '../../entities/spawners/LogSpawner';
import { AlligatorSpawner } from '../../entities/spawners/AlligatorSpawner';

export class SwampBiomeFeatures extends BaseBiomeFeatures {
    id: BiomeType = 'swamp';

    protected mangroveSpawner = new MangroveSpawner();
    protected logSpawner = new LogSpawner(0.003 * 5);
    protected alligatorSpawner = new AlligatorSpawner(0.009);

    getGroundColor(): { r: number, g: number, b: number } {
        return { r: 0x2B / 255, g: 0x24 / 255, b: 0x1C / 255 }; // Muddy Dark Brown
    }

    getScreenTint(): { r: number, g: number, b: number } {
        return { r: 0xB0 / 255, g: 0xA0 / 255, b: 0xD0 / 255 };
    }

    getFogDensity(): number {
        return 0.9;
    }

    getFogRange(): { near: number, far: number } {
        return { near: 0, far: 300 };
    }

    protected skyTopColors: number[] = [0xf5674c, 0xb99d95, 0xcfcff3]; // [Night, Sunset, Noon]
    protected skyBottomColors: number[] = [0xf5674c, 0xf5674c, 0xbbc1f1]; // [Night, Sunset, Noon]

    getAmplitudeMultiplier(): number {
        return 0.1;
    }

    getRiverWidthMultiplier(): number {
        return 5.0;
    }

    getBiomeLength(): number {
        return 400;
    }

    async decorate(context: DecorationContext, zStart: number, zEnd: number): Promise<void> {
        const length = zEnd - zStart;
        const count = Math.floor(length * 16);

        for (let i = 0; i < count; i++) {
            if (Math.random() > 0.5) continue;
            const position = context.decoHelper.generateRandomPositionInRange(context, zStart, zEnd);
            if (!context.decoHelper.isValidDecorationPosition(context, position)) continue;

            const rock = Decorations.getRock(this.id, Math.random());
            context.decoHelper.positionAndCollectGeometry(rock, position, context);
        }
    }

    async spawn(context: SpawnContext, difficulty: number, zStart: number, zEnd: number): Promise<void> {
        await this.spawnObstacle(this.logSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.rockSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.bottleSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.mangroveSpawner, context, difficulty, zStart, zEnd);
        await this.spawnObstacle(this.alligatorSpawner, context, difficulty, zStart, zEnd);
    }
}
